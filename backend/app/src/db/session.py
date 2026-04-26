from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from src.db.engine import async_session_maker

async def get_async_session() -> AsyncGenerator[AsyncSession]:
    db = async_session_maker
    try:
        yield db
    finally:
        await db.close()
