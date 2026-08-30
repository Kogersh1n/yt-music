import asyncio

import aioboto3
import aiofiles
from src.core.exceptions import ExternalServiceError
from contextlib import AsyncExitStack, asynccontextmanager
from src.core.config import settings


_s3_session = aioboto3.Session()

# Клиенты живут всё время работы процесса и переиспользуются.
#
# Раньше каждый вызов открывал свой клиент через `async with`. Создание
# клиента aiobotocore — это разбор модели сервиса S3 и подъём HTTP-сессии,
# то есть десятки миллисекунд. А подписание ссылки после этого — чистая
# арифметика без сети, микросекунды.
#
# Список треков подписывает обложку каждому по очереди, так что на выдаче
# из 30 песен накапливались секунды ожидания на ровном месте.
_clients: dict[str, object] = {}
_clients_lock = asyncio.Lock()
_exit_stack = AsyncExitStack()


async def _cached_client(endpoint_url: str):
    client = _clients.get(endpoint_url)
    if client is not None:
        return client

    async with _clients_lock:
        # Повторная проверка под замком: параллельные запросы на холодном
        # старте иначе создали бы по клиенту каждый.
        client = _clients.get(endpoint_url)
        if client is not None:
            return client

        client = await _exit_stack.enter_async_context(
            _s3_session.client(
                's3',
                endpoint_url=endpoint_url,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name='auto',
            )
        )
        _clients[endpoint_url] = client
        return client


async def close_s3_clients() -> None:
    """Закрывает клиентов при остановке приложения (см. lifespan в main.py)."""
    await _exit_stack.aclose()
    _clients.clear()


@asynccontextmanager
async def get_s3_client():
    # Контекстный менеджер сохранён, чтобы не трогать вызывающий код,
    # но клиента больше не закрывает — он общий.
    yield await _cached_client(settings.r2_endpoint_url)


@asynccontextmanager
async def get_s3_public_client():
    """Клиент с публичным endpoint — для presigned GET URL, которые пойдут в браузер."""
    yield await _cached_client(settings.r2_public_endpoint_url)


async def generate_presigned_put(bucket: str, key: str, content_type: str, expires: int) -> str:
    async with get_s3_client() as client:
        return await client.generate_presigned_url(
            'put_object',
            Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=expires
        )


async def generate_presigned_get(bucket: str, key: str, expires: int) -> str:
    async with get_s3_public_client() as client:
        return await client.generate_presigned_url(
            'get_object',
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires
        )

async def delete_object(bucket: str, key: str):
    async with get_s3_client() as client:
        try:
            await client.delete_object(Bucket=bucket, Key=key)
        except Exception:
            raise ExternalServiceError('R2', 'Failed delete file from storage')

async def upload_file_object(bucket: str, key: str, file_path: str):
    async with get_s3_client() as client:
        try:
            async with aiofiles.open(file_path, mode='rb') as f:
                file_data = await f.read()
            
            await client.put_object(
                Bucket=bucket,
                Key=key,
                Body=file_data
            )
        except Exception:
            raise ExternalServiceError('R2', 'Failed to upload file to storage')
            
    
async def check_health() -> bool:
    try:
        async with get_s3_client() as client:
            await client.head_bucket(Bucket=settings.R2_BUCKET)
        return True
    except Exception:
        return False
