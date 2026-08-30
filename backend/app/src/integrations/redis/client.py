from functools import lru_cache

import redis as sync_redis
import redis.asyncio as async_redis

from src.core.config import settings

@lru_cache
def get_redis_client() -> async_redis.Redis:
    return async_redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        password=(
            settings.REDIS_PASSWORD.get_secret_value()
            if settings.REDIS_PASSWORD
            else None
        ),
        decode_responses=True
    )

@lru_cache
def get_sync_redis_client() -> sync_redis.Redis:
    return sync_redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        password=(
            settings.REDIS_PASSWORD.get_secret_value()
            if settings.REDIS_PASSWORD
            else None
        ),
        decode_responses=True,
    )