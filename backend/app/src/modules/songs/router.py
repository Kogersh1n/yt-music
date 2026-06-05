from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import Depends, APIRouter,status,Query
from typing import Annotated

from src.db.session import get_async_session
from src.modules.songs.schemas import SongResponse,SongCreate
from src.modules.songs.service import song_service 

songs_router = APIRouter(prefix='/songs', tags=['song'])
Session_Dep = Annotated[AsyncSession, Depends(get_async_session)]


@songs_router.get(
    '/',
    response_model=list[SongResponse]
)
async def get_all_songs(
    session: Session_Dep,
    limit: int = Query(50, ge=1, le=100),
    page: int = Query(1, ge=1)
    ):
    return await song_service.get_all_songs(session=session, limit=limit, page=page)


@songs_router.get(
    '/upload-url'
)
async def upload_url(
    session: Session_Dep, *, 
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
    session: Session_Dep,
    song_in: SongCreate
):
    return await song_service.create_song(
        session=session, 
        song_in=song_in)
    


@songs_router.get(
    '/search',
    response_model=list[SongResponse],
)
async def search(session: Session_Dep, q: str = Query(min_length=1)):
    return await song_service.search_songs(session=session, query=q)