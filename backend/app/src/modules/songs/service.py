import os
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.exceptions import NotFoundError,BadRequestError
from src.core.pagination import decode_cursor, encode_cursor
from src.integrations.s3 import (
    generate_presigned_get,
    generate_presigned_put,
    delete_object,
    upload_file_object
    )

from src.modules.songs.models import Song
from src.modules.songs.repository import SongRepository,song_repository 
from src.modules.songs.schemas import SongCreate
from src.modules.songs.utils import download_youtube_audio, download_thumbnail


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


    async def get_all_songs(self, session: AsyncSession, cursor: None | str, limit: int):
        # return await self.repo.get_all(session=session, limit=limit)
        cursor_created_at = None
        cursor_id = None

        if cursor is not None:
            cursor_created_at, cursor_id = decode_cursor(cursor)
        
        songs = await self.repo.get_all_by_cursor(
                session=session,
                limit=limit,
                cursor_created_at=cursor_created_at,
                cursor_id=cursor_id
            )
        if len(songs) > limit:
            has_more = True
            songs_to_return = songs[:limit]

            last_song = songs_to_return[-1]

            next_cursor = encode_cursor(created_at=last_song.created_at, item_id=last_song.id)


        else:
            has_more = False
            songs_to_return = songs
            next_cursor = None
        
        return {
            "items": songs_to_return,
            "next_cursor": next_cursor,
            "has_more": has_more
        }
        
    
    async def import_from_youtube(self, session: AsyncSession, url: str) -> dict:
        audio_path = None
        cover_path = None

        try:
            meta = await download_youtube_audio(url=url)
            audio_path = meta['file_path']
            video_id = audio_path.split("/")[-1].replace(".mp3", "")

            cover_path = await download_thumbnail(url=meta['thumbnail_url'], video_id=video_id)

            r2_audio_key = f'{settings.R2_TRACKS_PREFIX}/{video_id}.mp3'
            r2_cover_key = f'{settings.R2_COVERS_PREFIX}/{video_id}.jpg'

            await upload_file_object(
                bucket=settings.R2_BUCKET,
                key=r2_audio_key,
                file_path=audio_path
            )

            await upload_file_object(
                bucket=settings.R2_BUCKET,
                key=r2_cover_key,
                file_path=cover_path
            )

            song = SongCreate(
                title=meta['title'],
                duration=meta['duration'],
                author=meta['author'],
                audio_file_key=r2_audio_key,
                cover_file_key=r2_cover_key
            )

            await self.repo.create(session=session, obj_in=song)

            return {'status': 'success', 'title': meta['title']}
        except Exception as e:
            raise e
        finally:
            if audio_path and os.path.exists(audio_path):
                os.remove(audio_path)
            if cover_path and os.path.exists(cover_path):
                os.remove(cover_path)
                
        
            




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
            await delete_object(bucket=settings.R2_BUCKET, key=song.cover_file_key)


    async def create_song(self, session: AsyncSession, song_in: SongCreate):
        return await self.repo.create(session=session, obj_in=song_in)


    async def search_songs(self, session: AsyncSession, query: str) -> list[Song]:
        return await self.repo.search(session=session, query_str=query)


song_service = SongService(repo=song_repository)