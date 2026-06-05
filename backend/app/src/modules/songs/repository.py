from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.repository import BaseRepository
from src.modules.songs.models import Song
from src.modules.songs.schemas import SongCreate, SongUpdate


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


song_repository = SongRepository()     
