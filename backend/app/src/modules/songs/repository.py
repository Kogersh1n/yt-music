from datetime import datetime
from uuid import UUID
from typing import Sequence

from sqlalchemy import delete, func, or_, select, tuple_, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.repository import BaseRepository
from src.modules.playlists.models import liked_songs
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
    
    async def is_liked(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        song_id: UUID,
    ) -> bool:
        stmt = select(liked_songs).where(
            liked_songs.c.user_id == user_id,
            liked_songs.c.song_id == song_id,
        )
        return (await session.execute(stmt)).first() is not None

    async def liked_ids(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
    ) -> set[UUID]:
        """Id понравившихся треков одним запросом.

        Нужно, чтобы список песен не делал по запросу на каждую строку:
        отдаём множество и сверяемся с ним в памяти.
        """
        stmt = select(liked_songs.c.song_id).where(liked_songs.c.user_id == user_id)
        return set((await session.execute(stmt)).scalars().all())

    async def add_like(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        song_id: UUID,
    ) -> bool:
        """True — лайк поставлен, False — он уже был.

        ON CONFLICT DO NOTHING, а не «проверить и вставить»: два быстрых
        нажатия подряд иначе гонятся за одну строку, и второе падает
        нарушением первичного ключа. Счётчик трогаем только при реальной
        вставке, иначе он разъедется с числом строк связи.
        """
        stmt = (
            pg_insert(liked_songs)
            .values(user_id=user_id, song_id=song_id)
            .on_conflict_do_nothing()
        )
        result = await session.execute(stmt)

        if result.rowcount == 0:
            return False

        await session.execute(
            update(Song).where(Song.id == song_id).values(liked=Song.liked + 1)
        )
        return True

    async def remove_like(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        song_id: UUID,
    ) -> bool:
        """True — лайк снят, False — его и не было."""
        result = await session.execute(
            delete(liked_songs).where(
                liked_songs.c.user_id == user_id,
                liked_songs.c.song_id == song_id,
            )
        )

        if result.rowcount == 0:
            return False

        # greatest(...,0): счётчик не должен уйти в минус, если история
        # лайков и счётчик когда-то разъехались.
        await session.execute(
            update(Song)
            .where(Song.id == song_id)
            .values(liked=func.greatest(Song.liked - 1, 0))
        )
        return True


song_repository = SongRepository()     
