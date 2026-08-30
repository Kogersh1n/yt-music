from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import ConflictError, NotFoundError
from src.modules.playlists.models import Playlist
from src.modules.playlists.repository import PlaylistRepository, playlist_repo
from src.modules.playlists.schemas import (
    PlaylistCreate,
    PlaylistDetailResponse,
    PlaylistResponse,
    PlaylistUpdate,
)
from src.modules.songs.repository import SongRepository, song_repository
from src.modules.songs.service import SongService, song_service


class PlaylistService:
    def __init__(
        self,
        repo: PlaylistRepository,
        song_repo: SongRepository,
        songs: SongService,
    ) -> None:
        self.repo = repo
        self.song_repo = song_repo
        self.songs = songs

    async def _require_own(
        self,
        session: AsyncSession,
        *,
        playlist_id: UUID,
        user_id: UUID,
    ) -> Playlist:
        playlist = await self.repo.get_for_user(
            session, playlist_id=playlist_id, user_id=user_id
        )
        if playlist is None:
            raise NotFoundError("Playlist", str(playlist_id))
        return playlist

    @staticmethod
    def _summary(playlist: Playlist, *, duration: int, count: int) -> PlaylistResponse:
        return PlaylistResponse(
            id=playlist.id,
            playlist_name=playlist.playlist_name,
            playlist_duration=duration,
            user_id=playlist.user_id,
            songs_count=count,
        )

    async def list_playlists(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
    ) -> list[PlaylistResponse]:
        rows = await self.repo.list_for_user(session, user_id=user_id)
        return [
            self._summary(playlist, duration=playlist.playlist_duration, count=count)
            for playlist, count in rows
        ]

    async def get_playlist(
        self,
        session: AsyncSession,
        *,
        playlist_id: UUID,
        user_id: UUID,
    ) -> PlaylistDetailResponse:
        playlist = await self._require_own(
            session, playlist_id=playlist_id, user_id=user_id
        )
        songs = await self.songs.with_cover_urls(list(playlist.songs))

        return PlaylistDetailResponse(
            id=playlist.id,
            playlist_name=playlist.playlist_name,
            playlist_duration=playlist.playlist_duration,
            user_id=playlist.user_id,
            songs_count=len(songs),
            songs=songs,
        )

    async def create_playlist(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        data: PlaylistCreate,
    ) -> PlaylistResponse:
        playlist = await self.repo.create(
            session,
            obj_in={"playlist_name": data.playlist_name, "user_id": user_id},
        )
        return self._summary(playlist, duration=0, count=0)

    async def rename_playlist(
        self,
        session: AsyncSession,
        *,
        playlist_id: UUID,
        user_id: UUID,
        data: PlaylistUpdate,
    ) -> PlaylistResponse:
        playlist = await self._require_own(
            session, playlist_id=playlist_id, user_id=user_id
        )
        count = len(playlist.songs)
        updated = await self.repo.update(session, db_obj=playlist, obj_in=data)

        return self._summary(
            updated,
            duration=updated.playlist_duration,
            count=count,
        )

    async def delete_playlist(
        self,
        session: AsyncSession,
        *,
        playlist_id: UUID,
        user_id: UUID,
    ) -> None:
        await self._require_own(session, playlist_id=playlist_id, user_id=user_id)
        await self.repo.delete(session, id=playlist_id)

    async def add_song(
        self,
        session: AsyncSession,
        *,
        playlist_id: UUID,
        user_id: UUID,
        song_id: UUID,
    ) -> PlaylistResponse:
        playlist = await self._require_own(
            session, playlist_id=playlist_id, user_id=user_id
        )

        if await self.song_repo.get(session, song_id) is None:
            raise NotFoundError("Song", str(song_id))

        if await self.repo.has_song(session, playlist_id=playlist_id, song_id=song_id):
            raise ConflictError("Трек уже в плейлисте")

        await self.repo.add_song(session, playlist_id=playlist_id, song_id=song_id)
        duration, count = await self.repo.recalc(session, playlist_id=playlist_id)

        return self._summary(playlist, duration=duration, count=count)

    async def remove_song(
        self,
        session: AsyncSession,
        *,
        playlist_id: UUID,
        user_id: UUID,
        song_id: UUID,
    ) -> PlaylistResponse:
        playlist = await self._require_own(
            session, playlist_id=playlist_id, user_id=user_id
        )

        removed = await self.repo.remove_song(
            session, playlist_id=playlist_id, song_id=song_id
        )
        if not removed:
            raise NotFoundError("Song in playlist", str(song_id))

        duration, count = await self.repo.recalc(session, playlist_id=playlist_id)

        return self._summary(playlist, duration=duration, count=count)


playlist_service = PlaylistService(
    repo=playlist_repo,
    song_repo=song_repository,
    songs=song_service,
)
