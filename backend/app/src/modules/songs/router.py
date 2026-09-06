from uuid import UUID
from typing import Annotated
from fastapi import APIRouter,status,Query

from src.modules.songs.schemas import *
from src.modules.songs.service import song_service 
from src.modules.songs.utils import SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT
from src.core.deps import SessionDep, UserDep


songs_router = APIRouter(prefix='/songs', tags=['song'])



@songs_router.get(
    '/upload-url',
    response_model=UploadCredentialsResponse    
        )
async def upload_url(
    *, 
    filename: str,
    file_type: str            
):
    return await song_service.get_upload_credentials(
        filename=filename,
        file_type=file_type
    )

@songs_router.get(
    '/upload-cover-url',
    # Раньше здесь стоял SongCoverResponse ({cover_url}), а сервис отдаёт
    # {upload_url, file_key} — ответ не проходил валидацию, и ручка падала.
    response_model=UploadCredentialsResponse
        )
async def upload_cover(*, filename: str, file_type: str):
    return await song_service.get_cover_upload_credentials(filename=filename, file_type=file_type)


@songs_router.get(
    '/search',
    response_model=list[SongResponse],
)
async def search(session: SessionDep, q: str = Query(min_length=1)):
    """Поиск по своей медиатеке. Поиск по ютубу — /songs/youtube/search."""
    return await song_service.search_library(session, query=q)


@songs_router.get('/liked', response_model=list[SongResponse])
async def liked_songs(session: SessionDep, user: UserDep):
    return await song_service.list_liked(session, user_id=user.id)


@songs_router.post(
    '/',
    response_model=SongResponse,
    status_code=status.HTTP_201_CREATED
    )
async def song_create(
    session: SessionDep,
    song_in: SongCreate
):
    return await song_service.create_song(
        session=session, 
        song_in=song_in)


@songs_router.get(
    '/',
    response_model=SongPaginationResponse
)
async def get_all_songs(
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    cursor: Annotated[str | None, Query(description="Base64 encoded cursor for pagination")] = None
    ):
    return await song_service.get_all_songs(session=session, limit=limit, cursor=cursor)


@songs_router.post(
        '/import/youtube'
)
async def import_from_youtube(session: SessionDep, import_data: SongYoutubeImport):
    return await song_service.import_from_youtube(session=session, url=import_data.query)


@songs_router.get(
    '/youtube/search',
    response_model=YouTubeSearchResponse,
)
async def youtube_search(
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(SEARCH_DEFAULT_LIMIT, ge=1, le=SEARCH_MAX_LIMIT),
):
    return await song_service.search_youtube_songs(query=q, limit=limit)


@songs_router.get('/youtube/stream/{video_id}', response_model=SongStreamResponse)
async def stream_without_saving(video_id: str):
    return await song_service.stream_without_download(video_id=video_id)


@songs_router.get(
        '/{song_id}',
        response_model=SongResponse
        )
async def get_song(session: SessionDep, song_id: UUID):
    return await song_service.get_song(session=session, song_id=song_id)

@songs_router.delete(
        '/{song_id}',
)
async def delete_song(session: SessionDep, song_id: UUID):
    await song_service.delete_song(session=session, song_id=song_id)


@songs_router.get('/{song_id}/stream', response_model=SongStreamResponse)
async def get_stream(session: SessionDep, song_id: UUID):
    return await song_service.get_stream_url(session=session, song_id=song_id)


@songs_router.get('/{song_id}/cover', response_model=SongCoverResponse)
async def get_cover(session: SessionDep, song_id: UUID):
    return await song_service.get_cover_url(session=session, song_id=song_id)

# Routers for likes

@songs_router.post('/{song_id}/like')
async def add_like(session: SessionDep, user: UserDep, song_id: UUID):
    return await song_service.add_like(session, user_id=user.id, song_id=song_id)


@songs_router.delete('/{song_id}/like')
async def remove_like(session: SessionDep, user: UserDep, song_id: UUID):
    return await song_service.remove_like(session, user_id=user.id, song_id=song_id)

