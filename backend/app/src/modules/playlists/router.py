from uuid import UUID

from fastapi import APIRouter, status

from src.core.deps import SessionDep, UserDep
from src.modules.playlists.schemas import (
    PlaylistCreate,
    PlaylistDetailResponse,
    PlaylistResponse,
    PlaylistUpdate,
)
from src.modules.playlists.service import playlist_service

playlists_router = APIRouter(prefix="/playlists", tags=["playlist"])


@playlists_router.get("/", response_model=list[PlaylistResponse])
async def list_playlists(session: SessionDep, user: UserDep):
    return await playlist_service.list_playlists(session, user_id=user.id)


@playlists_router.post(
    "/",
    response_model=PlaylistResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_playlist(data: PlaylistCreate, session: SessionDep, user: UserDep):
    return await playlist_service.create_playlist(session, user_id=user.id, data=data)


@playlists_router.get("/{playlist_id}", response_model=PlaylistDetailResponse)
async def get_playlist(playlist_id: UUID, session: SessionDep, user: UserDep):
    return await playlist_service.get_playlist(
        session, playlist_id=playlist_id, user_id=user.id
    )


@playlists_router.patch("/{playlist_id}", response_model=PlaylistResponse)
async def rename_playlist(
    playlist_id: UUID,
    data: PlaylistUpdate,
    session: SessionDep,
    user: UserDep,
):
    return await playlist_service.rename_playlist(
        session, playlist_id=playlist_id, user_id=user.id, data=data
    )


@playlists_router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_playlist(playlist_id: UUID, session: SessionDep, user: UserDep) -> None:
    await playlist_service.delete_playlist(
        session, playlist_id=playlist_id, user_id=user.id
    )


@playlists_router.post("/{playlist_id}/songs/{song_id}", response_model=PlaylistResponse)
async def add_song(
    playlist_id: UUID,
    song_id: UUID,
    session: SessionDep,
    user: UserDep,
):
    return await playlist_service.add_song(
        session, playlist_id=playlist_id, user_id=user.id, song_id=song_id
    )


@playlists_router.delete(
    "/{playlist_id}/songs/{song_id}",
    response_model=PlaylistResponse,
)
async def remove_song(
    playlist_id: UUID,
    song_id: UUID,
    session: SessionDep,
    user: UserDep,
):
    return await playlist_service.remove_song(
        session, playlist_id=playlist_id, user_id=user.id, song_id=song_id
    )
