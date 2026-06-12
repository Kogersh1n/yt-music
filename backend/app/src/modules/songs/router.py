from uuid import UUID

from fastapi import APIRouter,status,Query

from src.modules.songs.schemas import SongResponse,SongCreate
from src.modules.songs.service import song_service 
from src.core.deps import SessionDep


songs_router = APIRouter(prefix='/songs', tags=['song'])


@songs_router.get(
    '/',
    response_model=list[SongResponse]
)
async def get_all_songs(
    session: SessionDep,
    limit: int = Query(50, ge=1, le=100),
    page: int = Query(1, ge=1)
    ):
    return await song_service.get_all_songs(session=session, limit=limit, page=page)


@songs_router.get(
    '/upload-url'
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

@songs_router.get("/{song_id}/stream")
async def get_stream(session: SessionDep, song_id: UUID):
    return await song_service.get_stream_url(session=session, song_id=song_id)


@songs_router.get("/{song_id}/cover")
async def get_cover(session: SessionDep, song_id: UUID):
    return await song_service.get_cover_url(session=session, song_id=song_id)


@songs_router.get("/upload-cover-url")
async def upload_cover(*, filename: str, file_type: str):
    return await song_service.get_cover_upload_credentials(filename=filename, file_type=file_type)


    
@songs_router.get(
    '/search',
    response_model=list[SongResponse],
)
async def search(session: SessionDep, q: str = Query(min_length=1)):
    return await song_service.search_songs(session=session, query=q)