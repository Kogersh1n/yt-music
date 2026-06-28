from uuid import UUID
from typing import Annotated
from fastapi import APIRouter,status,Query

from src.modules.songs.schemas import *
from src.modules.songs.service import song_service 
from src.core.deps import SessionDep


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
    response_model=SongCoverResponse
        )
async def upload_cover(*, filename: str, file_type: str):
    return await song_service.get_cover_upload_credentials(filename=filename, file_type=file_type)


@songs_router.get(
    '/search',
    response_model=list[SongResponse],
)
async def search(q: str = Query(min_length=1)):
    return await song_service.search_songs( query=q)
    

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
async def youtube_search(q: str = Query(min_length=1, max_length=200)):
    return await song_service.search_songs(query=q)


@songs_router.get('/youtube/stream/{video_id}')
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
async def add_like(session: SessionDep, song_id: UUID):
    return await song_service.add_like(session=session, song_id=song_id)

