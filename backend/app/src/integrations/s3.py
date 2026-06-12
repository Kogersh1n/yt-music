import aioboto3
from contextlib import asynccontextmanager
from src.core.config import settings

_s3_session = aioboto3.Session()

@asynccontextmanager
async def get_s3_client():
    async with _s3_session.client(
        's3',
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name='auto'
    ) as client:
        yield client


async def generate_presigned_put(bucket: str, key: str, content_type: str, expires: int) -> str:
    async with get_s3_client() as client:
        return await client.generate_presigned_url(
            'put_object',
            Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=expires
        )


async def generate_presigned_get(bucket: str, key: str, expires: int) -> str:
    async with get_s3_client() as client:
        return await client.generate_presigned_url(
            'get_object',
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires
        )
    
async def check_health() -> bool:
    try:
        async with get_s3_client() as client:
            await client.head_bucket(Bucket=settings.R2_BUCKET)
        return True
    except Exception:
        return False
