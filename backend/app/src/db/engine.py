from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
from sqlalchemy.orm import sessionmaker

from src.core.config import settings

async_engine = create_async_engine(url=settings.db_url)
async_session_maker = async_sessionmaker(bind=async_engine)

sync_engine = create_engine(url=settings.sync_db_url)
sync_session_maker = sessionmaker(bind=sync_engine)
