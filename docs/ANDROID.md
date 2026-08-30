# Мобильное приложение (Android)

Клиент на Expo + React Native в папке `mobile/`. Веб-фронт (`frontend/`) он не
затрагивает — это отдельный проект со своими зависимостями.

## Что нужно на машине

| | Версия | Как проверить |
|---|---|---|
| JDK | 21 | `java -version` |
| Node | 26 | `node -v` |
| Android SDK | платформа 36, build-tools 36, platform-tools | `sdkmanager --list_installed` |

`ANDROID_HOME` уже прописан в `~/.zshrc`. Если сборка не находит SDK — проверьте
`mobile/android/local.properties`, там должен быть `sdk.dir=/home/duklet/Android/Sdk`.

## Запуск на телефоне

```bash
cd mobile
npm install
npx expo run:android          # соберёт debug и поставит на подключённое устройство
```

Телефон должен быть подключён по USB с включённой отладкой: `adb devices`
показывает его в списке. Проверить: `adb devices -l`.

## Куда приложение ходит за данными

Адрес бэкенда задаётся переменной `EXPO_PUBLIC_API_URL` (см. `mobile/.env.example`).
По умолчанию — `http://192.168.8.12:8000`.

**Это должен быть адрес машины в локальной сети, а не `localhost`**: `localhost`
для телефона — он сам. Узнать свой адрес:

```bash
ip -4 addr show scope global | grep -oP 'inet \K[\d.]+'
```

Адрес зашивается в сборку на этапе `expo prebuild`, поэтому после его смены нужно
пересобрать:

```bash
EXPO_PUBLIC_API_URL=http://<новый-адрес>:8000 npm run prebuild && npx expo run:android
```

### Ловушка локального стека: MinIO

Бэкенд не отдаёт аудио сам — он выдаёт подписанную ссылку на хранилище. Адрес в
этой ссылке берётся из `R2_PUBLIC_ENDPOINT_URL` в `backend/.env`. Если там стоит
`http://localhost:9000`, то список треков в приложении загрузится, **а звук не
пойдёт**: телефон постучится сам в себя.

Для проверки на устройстве в `backend/.env` нужно:

```
R2_PUBLIC_ENDPOINT_URL=http://192.168.8.12:9000
```

Проверить можно так: открыть в браузере **на телефоне** ссылку, которую отдаёт
`GET /songs/<id>/stream`. Если файл начал скачиваться — адрес правильный.

### Демо-режим

Если бэкенд недоступен, приложение не показывает пустой экран, а переключается на
демо-набор треков и играет их. Так его можно открыть и посмотреть, ничего не
поднимая. На главной при этом висит плашка «Демо-режим».

## Сборка APK для раздачи

```bash
cd mobile/android
./gradlew assembleRelease
```

Готовые файлы — в `mobile/android/app/build/outputs/apk/release/`.

Собираются отдельные APK под каждую архитектуру процессора (ABI splits) — так
каждый файл заметно меньше, чем один универсальный. Для современного телефона
нужен `app-arm64-v8a-release.apk`.

Установить:

```bash
adb install -r app-arm64-v8a-release.apk
```

### Ключ подписи

Ключ лежит в `mobile/android/app/release.keystore`, пароли — в
`mobile/android/keystore.properties`. **Оба файла в git не попадают** (см.
`mobile/.gitignore`).

Если ключ потерян — переустановить обновление поверх старой версии не получится,
только удалив приложение. Сделайте копию в надёжном месте.

Создать ключ заново:

```bash
keytool -genkeypair -v -keystore mobile/android/app/release.keystore \
  -alias ytmusic -keyalg RSA -keysize 2048 -validity 10000
```

## Заметки по бэкенду (на будущее, приложение это не ломает)

Всплыло при проверке на реальных данных — чинить в `backend/`, приложение уже
обходит эти места:

- **`GET /songs/search` всегда возвращает 500.** В роутере он объявлен как
  `list[SongResponse]`, а `song_service.search_songs()` отдаёт
  `{results, query}` с YouTube — ответ не проходит валидацию. Приложение этот
  эндпоинт не вызывает: по своей медиатеке ищет локально, по YouTube — через
  `/songs/youtube/search`.
- **Обложки из YouTube приходят с чёрными полосами.** yt-dlp сохраняет кадр
  16:9, дополненный до 4:3 (640×480 с полосами сверху и снизу). В квадратной
  плитке полосы остаются видны. Лечится на импорте: брать `maxresdefault` или
  обрезать полосы перед заливкой в хранилище.
- **`POST /songs/{id}/like` ничего не делает** — тело `add_like()` пустое, а
  `SongResponse.liked` это общий счётчик. Лайки в приложении пока локальные.

## Полезные команды

```bash
npm run tsc          # проверка типов
npm run doctor       # диагностика совместимости версий Expo
npm run prebuild     # пересоздать android/ после смены app.config.ts
adb logcat | grep -i ytmusic   # логи с устройства
```

## Проверка без телефона (эмулятор)

Если устройства под рукой нет, всё поднимается локально:

```bash
sdkmanager "emulator" "system-images;android-36;google_apis;x86_64"
avdmanager create avd -n ytmusic_test -k "system-images;android-36;google_apis;x86_64" -d pixel_7
emulator -avd ytmusic_test -no-window -gpu swiftshader_indirect &
adb wait-for-device

# эмулятор не видит машину по LAN — пробрасываем порты внутрь
adb reverse tcp:8081 tcp:8081     # Metro
adb reverse tcp:8000 tcp:8000     # бэкенд
adb reverse tcp:9000 tcp:9000     # MinIO (иначе не будет обложек и звука)

npx expo run:android
```

При таком пробросе `EXPO_PUBLIC_API_URL=http://localhost:8000` работает, и
подпись ссылок MinIO не ломается — потому что хост остаётся `localhost`.
