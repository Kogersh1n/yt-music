from datetime import datetime
from uuid import UUID
from typing import Sequence

from sqlalchemy import select, or_, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.repository import BaseRepository
from src.modules.songs.models import Song
from src.modules.songs.schemas import SongCreate, SongUpdate

# from src.core.pagination import encode_cursor, decode_cursor


class SongRepository(BaseRepository[Song, SongCreate, SongUpdate]):
    def __init__(self):
        super().__init__(Song)
    
    async def get_by_title(self, session: AsyncSession, *, title: str) -> list[Song]:
        query = select(Song).where(Song.title.ilike(f"%{title}%"))
        result = await session.execute(query)
        return result.scalars().all()

    async def get_by_author(self, session: AsyncSession, *, author: str) -> list[Song]:
        query = select(Song).where(Song.author.ilike(f"%{author}%"))
        result = await session.execute(query)
        return result.scalars().all()

    async def search(self, session: AsyncSession, *, query_str: str) -> list[Song]:
        query = select(Song).where(
            or_(
                Song.title.ilike(f"%{query_str}%"),
                Song.author.ilike(f"%{query_str}%")
            )
        )
        result = await session.execute(query)
        return list(result.scalars().all())
    
    async def get_all_by_cursor(
                self,
                session: AsyncSession,
                *,
                limit: int,
                cursor_created_at: datetime | None = None,
                cursor_id: UUID | None = None
            ) -> Sequence[Song]:
        query = select(Song).order_by(Song.created_at.desc(),Song.id.desc()).limit(limit+1)

        if cursor_created_at and cursor_id:
            query = query.where(tuple_(Song.created_at, Song.id) < (tuple_(cursor_created_at, cursor_id)))
        
        result = await session.execute(query)

        return result.scalars().all()
    

song_repository = SongRepository()     
