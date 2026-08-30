# Исправления логики refresh-токенов

Дата: 2026-08-26 · ветка `main` · модуль `backend/app/src/modules/auth`

Разбор и починка ошибок в ротации refresh-токенов. Два бага ломали саму логику
детекта кражи, остальные не давали модулю импортироваться.

---

## Критичные: ломали логику ротации

### 1. Отзыв семьи откатывался вместе с исключением

**Файл:** `modules/auth/service.py`, метод `_reject_claim`

`revoke_family()` выполнял `UPDATE`, после чего метод бросал `TokenExpiredOrInvalid`.
Исключение доходило до `get_async_session`, где стоит:

```python
except Exception:
    await session.rollback()
    raise
```

Откат отменял и отзыв семьи. Детект срабатывал, писал в лог «погашено N токенов» —
и не гасил ничего. Семья оставалась живой, вор продолжал работать, а лог
утверждал обратное.

**Исправлено:** явный `await session.commit()` перед `raise`. Это единственное
место в модуле, где ручной коммит оправдан — именно потому, что следом идёт
исключение. Последующий `rollback()` в зависимости откатывать будет уже нечего.

### 2. `verified` никогда не становился `True`

**Файлы:** `modules/users/schemas.py`, `modules/auth/service.py`

В модели `User.verified` стоит `default=False`, а `UserCreate` поля `verified`
не содержала. Подтверждённый по почте пользователь оставался неподтверждённым.

При этом `refresh_tokens` проверяет `not user.verified` — то есть **любой refresh
отбивался бы у всех пользователей всегда**. Логин при этом работает (там проверки
нет), поэтому баг проявился бы только через 15 минут после входа, когда протухнет
первый access-токен.

**Исправлено:** в `UserCreate` добавлено `verified: bool = False`, а `verify_user`
передаёт `verified=True` — почту только что подтвердили.

### 3. `AppError` затирал `status_code` пятисоткой

**Файл:** `core/exceptions.py`

```python
def __init__(self, detail: str, status_code: int = 500):
    if status_code is not None:
        self.status_code = status_code    # 500 никогда не None
```

Дефолт `500` не равен `None`, поэтому условие всегда истинно и класс-атрибут
затирался. `NotFoundError` отдавала 500 вместо 404 — это уже ломало
`users/service.py` и `songs/service.py`. Плюс `detail` был обязательным
позиционным, из-за чего `InvalidCredentials()` бросал `TypeError`.

**Исправлено:** оба параметра стали `| None = None`.

Проверено:

| исключение | статус | detail |
|---|---|---|
| `NotFoundError('User','x')` | 404 | `User 'x' not found` |
| `InvalidCredentials()` | 401 | `Could not validate credentials` |
| `CredentialsTaken()` | 400 | `Email or username is already taken` |
| `UnauthorizedError('custom')` | 401 | `custom` |

---

## Блокеры импорта

### 4. `auth/exceptions.py` импортировал несуществующие имена

Тянул `NotAuthenticatedError` и `PermissionDeniedError`; в `core/exceptions.py`
классы называются `UnauthorizedError` и `ForbiddenError`. `ImportError` при первом
же импорте сервиса.

### 5. Циклический импорт smtp ↔ celery

**Файл:** `integrations/celery/tasks.py:2`

Импортировал `get_smtp_client` из `smtp.service`, хотя функция определена в
`smtp.client` (а `smtp.service` сам её оттуда реэкспортирует). Цикл не давал
импортировать модуль auth целиком.

**Исправлено:** импорт переведён на `src.integrations.smtp.client`.

### 6. Мусорная строка в `register_user`

```python
refresh_token = create_refresh_token(user.id)
```

`create_refresh_token` удалён при переходе на опаковые токены и не импортирован,
`user` в этой функции не определён. Два `NameError` в одной строке. Удалена.

### 7. Голый `raise` в `register_user`

Вне блока `except` даёт `RuntimeError: No active exception to re-raise` —
то есть 500 вместо 400 на занятый email. Заменён на `CredentialsTaken()`.

---

## Перевод на новую схему токенов

`verify_user` и `login_user` оставались в старом мире JWT-refresh:

| было | стало |
|---|---|
| `get_verification(email)` без `await` | `await get_verification(email)` |
| `token=refresh_token.token` | `token_hash=...` через `_issue_token_pair` |
| `family_id` не передавался (поле обязательное) | генерируется внутри `_issue_token_pair` |
| `expires_at` из `refresh_token.payload.exp` | считается от `REFRESH_TOKEN_EXPIRE_SECONDS` |
| `create_refresh_token(user.id)` | `generate_refresh_token()` |
| `TokensResponse(a, b)` позиционно | по именам |
| `get_by_email(session, email)` позиционно | `email=email` (аргумент keyword-only) |
| `except Exception` вокруг вставки токена | `except IntegrityError` вокруг создания пользователя |

Последняя строка отдельно: `try/except` стоял вокруг вставки refresh-токена,
хотя конфликт уникальности email/username возникает в `user_repo.create` —
то есть обработчик стоял не на том стейтменте, а сообщение об ошибке врало.

Оба метода теперь сводятся к двум строкам:

```python
tokens, _ = await self._issue_token_pair(session, user_id=user.id)
return tokens
```

Ради этого `_issue_token_pair` и писался — он нужен в трёх местах, а вызывался
только из `refresh_tokens`.

---

## Мелочи

- `modules/auth/repository.py` — у `get_token_by_hash` не было аннотации типа
  на `token_hash`.
- `refresh_tokens` — добавлены аннотации `raw_token: str` и `-> TokensResponse`.
- `service.py` — убран неиспользуемый импорт `User`, добавлен `IntegrityError`.
- Добавлены докстроки к `_issue_token_pair` и `_reject_claim`: первый объясняет
  семантику `family_id`, второй — почему метод всегда бросает.

---

## Проверено

```
модели конфигурируются: ок          # back_populates='refresh_tokens' сходится
auth.service импортируется: ок      # вся цепочка, включая smtp и celery
статус-коды исключений: 404 / 401 / 400 — верные
UserCreate(verified=True): работает
SMTP  -> localhost:1025, sender ok, auth пропускается при пустом USERNAME
Redis -> redis://localhost:6379/0, клиент создаётся без пароля
```

Полноценный прогон не делался — нужна живая БД и Redis.

---

## Конфигурация: SMTP и Redis

Отдельный заход после основной починки — без этого модуль auth не импортировался.

### SMTPSettings переведён на `BaseSettings`

**Файлы:** `integrations/smtp/config.py`, `integrations/smtp/client.py`

`SMTPSettings` был `BaseModel`, то есть окружение не читал вообще — просто
контейнер, который `get_smtp_client()` заполнял вручную из глобального
`Settings`. А SMTP-полей в `Settings` не было ни одного, отсюда `AttributeError`.

Вместо добавления пяти полей в `Settings` интеграция сделана самодостаточной:

```python
class SMTPSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=('.env', '../.env'),
        env_prefix='SMTP_',
        extra='ignore',
    )
```

Читает `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_SENDER`.
`USERNAME`/`PASSWORD` пустые по умолчанию — локальные заглушки (mailpit, mailhog)
работают без авторизации, а `SMTPClient` и так пропускает login при пустом
`USERNAME`. `extra='ignore'` обязателен, иначе споткнётся об остальные
переменные в `.env`.

`get_smtp_client()` схлопнулся до `return SMTPClient(SMTPSettings())`,
импорт `settings` из `client.py` убран за ненадобностью.

`core/config.py` остался без SMTP-полей — это осознанно: интеграция владеет
своей конфигурацией, удаление папки не оставляет следов в ядре.

### `REDIS_PASSWORD = None` ронял три места

`REDIS_PASSWORD` объявлен как `SecretStr | None = None`, но `.get_secret_value()`
вызывался безусловно в трёх точках:

- `integrations/redis/client.py` — async-клиент
- `integrations/redis/client.py` — sync-клиент
- `integrations/celery/client.py` — broker и backend

Локальный Redis обычно без пароля, поэтому правильнее обработать `None`,
а не выдумывать пароль. В redis-клиентах — условное выражение, в celery —
через новое свойство:

```python
@property
def redis_url(self) -> str:
    auth = (
        f":{self.REDIS_PASSWORD.get_secret_value()}@"
        if self.REDIS_PASSWORD
        else ""
    )
    return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
```

Попутно исправлено ещё одно: celery хардкодил `@redis:6379/0`, игнорируя
`REDIS_HOST`/`REDIS_PORT`/`REDIS_DB` из `Settings`. Локально это означало
попытку достучаться до хоста `redis` вместо `localhost`. Теперь источник один.

### `.env.example` дополнен секцией SMTP

Секция Redis там уже была — но в реальном `.env` её нет, шаблон ушёл вперёд.

Напоминание про сам механизм: читаются только `.env` и `../.env`
(см. `SettingsConfigDict` в `core/config.py`). `.env.example` не читается
никогда — это шаблон для человека, единственный из env-файлов, попадающий
в git (`.gitignore`: `!.env.example`). Настоящие секреты туда класть нельзя.

---

## Локальная почта: mailpit

**Файлы:** `docker-compose.yml`, `backend/.env`, `backend/.env.example`

Одного mailpit было мало — письмо уходит через `send_email.delay()`, то есть
через celery, а в compose не было ни брокера, ни воркера. Добавлены три сервиса:

| сервис | зачем | порты |
|---|---|---|
| `redis` | коды подтверждения + брокер celery | 6379 |
| `mailpit` | ловит письма, наружу ничего не уходит | 1025 (SMTP), 8025 (веб) |
| `worker` | исполняет задачи celery, иначе письмо не отправится | — |

У `web` и `worker` в `environment` перекрыты `REDIS_HOST: redis` и
`SMTP_HOST: mailpit`. `environment` имеет приоритет над `env_file`, поэтому
в `.env` остаются значения для запуска с хоста (`localhost`), а внутри compose
сервисы находят друг друга по именам.

### Правки в `.env`

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SENDER` отсутствовали. `HOST` и `SENDER`
  обязательны — без них `SMTPSettings()` падает на валидации при импорте.
- `SMTP_USERNAME` / `SMTP_PASSWORD` были `CHANGE_ME`. Обнулены: mailpit работает
  без авторизации, а `SMTPClient:35` вызывает `server.login()` при непустом
  `USERNAME` и получил бы отказ.
- `REDIS_PASSWORD=password` при том, что redis в compose поднимается без
  авторизации. Обнулён; в `.env.example` заодно заменён на пустое значение
  с комментарием.

Бэкап исходного файла — `backend/.env.bak`, можно удалить.

### Проверено

Docker из сессии недоступен (нет прав на сокет), поэтому проверка шла против
самодельной SMTP-заглушки на том же порту 1025:

```
конфиг    : localhost:1025 | sender: noreply@ytmusic.local | login: пропускается
письмо принято сервером, длина: 201 байт
    Subject: Verify your email
    From: noreply@ytmusic.local
    To: user@example.com
    Your verification code is: 12345
```

Цепочка `.env` -> `SMTPSettings` -> `SMTPClient` -> сокет работает целиком.
Сам mailpit в контейнере не запускался — это остаётся проверить руками.

---

## Известные проблемы, оставленные как есть

**`SMTPClient.send_email` глотает ошибки.** `except SMTPException` пишет
`logging.warning("Failed to send message")` и молчит дальше. Пользователь
получает успешный ответ на регистрацию, письма не приходит, в логе одна строка
без причины. Стоит хотя бы логировать исключение целиком.

**`beat_schedule` ссылается на несуществующую задачу.** В
`integrations/celery/client.py` расписание содержит `cleanup_orphaned_avatars`,
но в `integrations/celery/tasks.py` определена только `send_email`. celery beat
на этой записи споткнётся.

**`used_at` откатывается, если пользователь не найден.** Если `claim()` прошёл,
а `user is None or not user.verified` — исключение откатит и простановку
`used_at`. Токен вернётся в живое состояние, и клиент сможет дёргать `/refresh`
бесконечно. Не опасно (войти всё равно нельзя), но семантически неаккуратно.

**`decode_jwt` всё ещё `async` и без проверки `type`.** Пока не вызывается,
но `get_current_user` на этапе 8 упрётся: нужна синхронная функция с параметром
`expected_type`.

**`revoke()` не используется** — logout не написан (этап 10).

---

## Что дальше

По плану ротации остаются этапы 8–11:

1. `get_current_user` в `core/deps.py` — сейчас там только `SessionDep`
2. `auth/router.py` (0 байт) + `include_router` в `main.py`
3. logout / logout-all / отзыв при смене пароля
4. celery-задача на уборку протухших токенов, WARNING-метрики, rate limit

Отдельно, до первого запуска: дописать в реальный `.env` секции Redis и SMTP
по образцу из `.env.example`. `SMTP_HOST` и `SMTP_SENDER` обязательны —
без них `SMTPSettings()` бросит ошибку валидации при импорте (это намеренный
fail-fast: приложение, рассылающее письма живым людям, не должно стартовать
с недонастроенной почтой).
