import json
import secrets

from pydantic import EmailStr

from src.core.config import settings
from src.integrations.redis.client import get_redis_client

"""Коды для восстановления пароля.

Механика та же, что у подтверждения почты: код с ограниченным сроком
жизни в Redis. Отличие одно, и оно существенное — счётчик попыток.

Код пятизначный, то есть вариантов сто тысяч. Для подтверждения почты
это приемлемо: перебор даёт доступ к ящику, которым и так владеет тот,
кто проходит регистрацию. Для сброса пароля перебор даёт чужой аккаунт,
поэтому после нескольких неверных попыток код сгорает — иначе сто тысяч
вариантов перебираются за минуты, особенно пока нет ограничения частоты
запросов на уровне сервера.
"""

#: Сколько неверных вводов переживает код. Пять — это запас на опечатку,
#: но не на перебор.
MAX_ATTEMPTS = 5


def _key(email: EmailStr) -> str:
    return f"reset:{email}"


def generate_reset_code() -> str:
    return f"{secrets.randbelow(10**5):05d}"


async def store_reset_code(email: EmailStr, code: str) -> None:
    """Кладёт код, затирая предыдущий.

    Затирание намеренное: повторный запрос восстановления должен обнулять
    и счётчик попыток, иначе человек, исчерпавший попытки на опечатках,
    не смог бы начать заново.
    """
    redis_client = get_redis_client()
    await redis_client.setex(
        _key(email),
        settings.PASSWORD_RESET_TOKEN_EXPIRE_SECONDS,
        json.dumps({"code": code, "attempts": 0}),
    )


async def check_reset_code(email: EmailStr, code: str) -> bool:
    """Сверяет код и расходует попытку.

    Возвращает True только при точном совпадении. Неверный ввод
    приближает код к сгоранию; исчерпанные попытки удаляют его сразу,
    не дожидаясь истечения срока.
    """
    redis_client = get_redis_client()
    raw = await redis_client.get(_key(email))
    if raw is None:
        return False

    data = json.loads(raw)
    if data["code"] == code:
        return True

    attempts = data["attempts"] + 1
    if attempts >= MAX_ATTEMPTS:
        await redis_client.delete(_key(email))
        return False

    # Срок жизни ключа сохраняем: неверная попытка не должна его продлевать,
    # иначе перебор растягивал бы окно бесконечно.
    ttl = await redis_client.ttl(_key(email))
    await redis_client.setex(
        _key(email),
        max(ttl, 1),
        json.dumps({"code": data["code"], "attempts": attempts}),
    )
    return False


async def delete_reset_code(email: EmailStr) -> None:
    redis_client = get_redis_client()
    await redis_client.delete(_key(email))
