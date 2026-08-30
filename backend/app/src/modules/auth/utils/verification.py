import json
import secrets

from pydantic import EmailStr

from src.core.config import settings
from src.integrations.redis.client import get_redis_client
from src.modules.auth.schemas import VerificationData

def generate_verification_code() -> str:
    return f"{secrets.randbelow(10**5):05d}"

async def store_verification(
        email: EmailStr,
        code: str,
        username: str,
        hashed_password: str
    ) -> None:
    redis_client = get_redis_client()
    key = f"verify:{email}"

    await redis_client.setex(
        key,
        settings.VERIFICATION_CODE_EXPIRE_SECONDS,
        json.dumps(
            {"code": code, "username": username, "hashed_password": hashed_password},
        ),
    )

async def get_verification(
        email: EmailStr,
    ) -> None | VerificationData:
    redis_client = get_redis_client()
    key = f'verify:{email}'
    code = await redis_client.get(key)

    if code is None:
        return None
    return VerificationData(**json.loads(code))


async def delete_verification_code(
     email: EmailStr   
    ) -> None:
    redis_client = get_redis_client()
    key = f'verify:{email}'
    await redis_client.delete(key)


