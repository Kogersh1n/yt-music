from uuid import UUID, uuid4


from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.exceptions import NotFoundError,BadRequestError
from src.integrations.s3 import generate_presigned_get, generate_presigned_put, delete_object

from src.modules.songs.models import Song
from src.modules.songs.repository import SongRepository,song_repository 
from src.modules.songs.schemas import SongResponse, SongCreate

ALLOWED_AUDIO_TYPES = {"audio/mpeg", "audio/wav", "audio/flac", "audio/ogg", "audio/aac", "audio/mp4"}
ALLOWED_AUDIO_EXTENSIONS = {"mp3", "wav", "flac", "ogg", "aac", "m4a"}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}

class SongService:
    def __init__(self, repo: SongRepository):
        self.repo = repo
    
    async def get_upload_credentials(self, filename: str, file_type: str) -> dict:

        ext = filename.split('.')[-1].lower()

        if file_type not in ALLOWED_AUDIO_TYPES or ext not in ALLOWED_AUDIO_EXTENSIONS:
            raise BadRequestError(f"Invalid audio format {file_type}") 

        safe_filename = f"{settings.R2_TRACKS_PREFIX}/{uuid4()}.{ext}"
        
        presigned_url = await generate_presigned_put(
                bucket=settings.R2_BUCKET,
                key=safe_filename,
                content_type=file_type,
                expires=settings.R2_PRESIGNED_URL_EXPIRE_SECONDS
            )
        
        return {
            'upload_url': presigned_url,
            'file_key': safe_filename
        }


    async def get_cover_upload_credentials(self, filename: str, file_type: str) -> dict:
        ext = filename.split('.')[-1].lower()

        if file_type not in ALLOWED_IMAGE_TYPES or ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise BadRequestError(f"Invalid image type {file_type}")
        
        safe_filename = f"{settings.R2_COVERS_PREFIX}/{uuid4()}.{ext}"

        presigned_url = await generate_presigned_put(
            bucket=settings.R2_BUCKET,
            key=safe_filename,
            content_type=file_type,
            expires=settings.R2_PRESIGNED_URL_EXPIRE_SECONDS
        )

        return {
            "upload_url": presigned_url,
            "file_key": safe_filename
        }

    
    async def get_stream_url(self, session: AsyncSession, song_id: UUID) -> dict:
        song = await self.repo.get(session=session, id=song_id)
        if song is None:
            raise NotFoundError("Song", str(song_id))

        stream_url= await generate_presigned_get(
            bucket=settings.R2_BUCKET,
            key=song.audio_file_key,
            expires=settings.R2_PRESIGNED_URL_EXPIRE_SECONDS
        )
        return {"stream_url": stream_url, "duration": song.duration}


    async def get_cover_url(self, session: AsyncSession, song_id: UUID) -> dict:
        song = await self.repo.get(session=session, id=song_id)
        if song is None:
            raise NotFoundError("Song", str(song_id))
        if song.cover_file_key is None:
            return {"cover_url": None}

        cover_url = await generate_presigned_get(
            bucket=settings.R2_BUCKET,
            key=song.cover_file_key,
            expires=settings.R2_PRESIGNED_URL_EXPIRE_SECONDS
        )
        return {"cover_url": cover_url}

    
    async def get_all_songs(self, session: AsyncSession, limit: int, page: int):
        return await self.repo.get_all(session=session, limit=limit, page=page)
    

    async def get_song(self, session: AsyncSession, song_id: UUID):
        song = await self.repo.get(session=session, id=song_id)
        if song is None:
            raise NotFoundError("Song", str(song_id))
        
        return song
    
    async def delete_song(self, session: AsyncSession, song_id: UUID):
        song = await self.repo.get(session=session, id=song_id)
        if song is None:
            raise NotFoundError("Song", str(song_id))
        
        await self.repo.delete(session=session, id=song_id)
        await session.flush()

        await delete_object(bucket=settings.R2_BUCKET, key=song.audio_file_key)

        if song.cover_file_key:
            await delete_object(bucket=settings.R2_COVERS_BUCKET, key=song.cover_file_key)


    async def create_song(self, session: AsyncSession, song_in: SongCreate):
        return await self.repo.create(session=session, obj_in=song_in)


    async def search_songs(self, session: AsyncSession, query: str) -> list[Song]:
        return await self.repo.search(session=session, query_str=query)


song_service = SongService(repo=song_repository)