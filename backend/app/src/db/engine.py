from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine

from src.core.config import settings

async_engine = create_async_engine(url=settings.db_url)
async_session_maker = async_sessionmaker(bind=async_engine) 
