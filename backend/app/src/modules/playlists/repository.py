from uuid import UUID

from sqlalchemy import delete, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.repository import BaseRepository
from src.modules.playlists.models import Playlist, playlist_song
from src.modules.playlists.schemas import PlaylistCreate, PlaylistUpdate
from src.modules.songs.models import Song


class PlaylistRepository(BaseRepository[Playlist, PlaylistCreate, PlaylistUpdate]):
    def __init__(self) -> None:
        super().__init__(Playlist)

    async def list_for_user(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
    ) -> list[tuple[Playlist, int]]:
        songs_count = (
            select(func.count())
            .select_from(playlist_song)
            .where(playlist_song.c.playlist_id == Playlist.id)
            .scalar_subquery()
        )

        stmt = (
            select(Playlist, songs_count)
            .where(Playlist.user_id == user_id)
            .order_by(Playlist.playlist_name)
        )

        result = await session.execute(stmt)
        return [(row[0], row[1]) for row in result.all()]

    async def get_for_user(
        self,
        session: AsyncSession,
        *,
        playlist_id: UUID,
        user_id: UUID,
    ) -> Playlist | None:
        stmt = (
            select(Playlist)
            .where(Playlist.id == playlist_id, Playlist.user_id == user_id)
            .options(selectinload(Playlist.songs))
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def has_song(
        self,
        session: AsyncSession,
        *,
        playlist_id: UUID,
        song_id: UUID,
    ) -> bool:
        stmt = select(playlist_song).where(
            playlist_song.c.playlist_id == playlist_id,
            playlist_song.c.song_id == song_id,
        )
        return (await session.execute(stmt)).first() is not None

    async def add_song(
        self,
        session: AsyncSession,
        *,
        playlist_id: UUID,
        song_id: UUID,
    ) -> None:
        await session.execute(
            insert(playlist_song).values(playlist_id=playlist_id, song_id=song_id)
        )

    async def remove_song(
        self,
        session: AsyncSession,
        *,
        playlist_id: UUID,
        song_id: UUID,
    ) -> bool:
        result = await session.execute(
            delete(playlist_song).where(
                playlist_song.c.playlist_id == playlist_id,
                playlist_song.c.song_id == song_id,
            )
        )
        return result.rowcount > 0

    async def recalc(
        self,
        session: AsyncSession,
        *,
        playlist_id: UUID,
    ) -> tuple[int, int]:
        row = (
            await session.execute(
                select(
                    func.coalesce(func.sum(Song.duration), 0),
                    func.count(),
                )
                .select_from(playlist_song)
                .join(Song, Song.id == playlist_song.c.song_id)
                .where(playlist_song.c.playlist_id == playlist_id)
            )
        ).one()

        duration, count = int(row[0] or 0), int(row[1] or 0)

        playlist = await self.get(session, playlist_id)
        if playlist is not None:
            playlist.playlist_duration = duration
            await session.flush()

        return duration, count


playlist_repo = PlaylistRepository()
