import asyncio
import os
import re
import time
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.integrations.redis.client import get_redis_client
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
from src.modules.songs.schemas import SongCreate, SongResponse, YouTubeSearchResponse
from src.modules.songs.utils import download_youtube_audio, download_thumbnail, get_youtube_stream_url, search_youtube


ALLOWED_AUDIO_TYPES = {"audio/mpeg", "audio/wav", "audio/flac", "audio/ogg", "audio/aac", "audio/mp4"}
ALLOWED_AUDIO_EXTENSIONS = {"mp3", "wav", "flac", "ogg", "aac", "m4a"}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}

class SongService:
    def __init__(self, repo: SongRepository):
        self.repo = repo
    
    async def _enrich_with_cover_url(self, song: Song) -> SongResponse:
        """Convert a Song ORM object to SongResponse with a presigned cover URL."""
        cover_url = None
        if song.cover_file_key:
            cover_url = await generate_presigned_get(
                bucket=settings.R2_BUCKET,
                key=song.cover_file_key,
                expires=settings.R2_PRESIGNED_URL_EXPIRE_SECONDS
            )
        resp = SongResponse.model_validate(song)
        resp.cover_url = cover_url
        return resp

    async def _enrich_many(self, songs: list[Song]) -> list[SongResponse]:
        """Enrich a list of Song ORM objects with presigned cover URLs."""
        # gather, а не цикл: даже с общим клиентом подписание идёт через
        # await, и последовательный обход растягивал бы выдачу списка.
        return list(await asyncio.gather(*(self._enrich_with_cover_url(s) for s in songs)))

    async def with_cover_urls(self, songs: list[Song]) -> list[SongResponse]:
        """Публичная обёртка над обогащением обложками.

        Нужна плейлистам: подписывать ссылки они должны так же, как медиатека,
        а копия этой логики рано или поздно разошлась бы с оригиналом.
        """
        return await self._enrich_many(songs)
    
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
        
        enriched = await self._enrich_many(list(songs_to_return))

        return {
            "items": enriched,
            "next_cursor": next_cursor,
            "has_more": has_more
        }
        
    
    async def import_from_youtube(self, session: AsyncSession, url: str) -> dict:
        audio_path = None
        cover_path = None

        try:
            meta = await download_youtube_audio(url=url)
            audio_path = meta['file_path']
            video_id = meta['video_id']

            # Расширение больше не всегда .mp3 — перекодирование убрано,
            # ютуб отдаёт m4a. Берём его из фактического имени файла.
            ext = os.path.splitext(audio_path)[1].lstrip('.') or 'm4a'

            cover_path = await download_thumbnail(url=meta['cover_url'], song_id=video_id)

            r2_audio_key = f'{settings.R2_TRACKS_PREFIX}/{video_id}.{ext}'
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
                title=meta['title'][:50],
                duration=meta['duration'],
                author=meta['author'][:100],
                audio_file_key=r2_audio_key,
                cover_file_key=r2_cover_key,
                # Без этого синхронизация и рекомендации не понимают,
                # что трек уже скачан, и предлагают его снова.
                youtube_id=video_id,
            )

            created = await self.repo.create(session=session, obj_in=song)

            return {
                'status': 'success',
                'id': str(created.id),
                'title': created.title,
                'author': created.author,
                'youtube_id': created.youtube_id,
            }
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
        
        return await self._enrich_with_cover_url(song)
    
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

    async def search_library(
        self,
        session: AsyncSession,
        *,
        query: str,
    ) -> list[SongResponse]:
        """Поиск по своей медиатеке — по названию и исполнителю.

        Раньше эта ручка звала search_youtube и объявляла ответ как
        list[SongResponse]: сервис отдавал {results, query} с ютуба, ответ
        не проходил валидацию, и эндпоинт падал всегда. Поиск по ютубу
        живёт отдельно, в search_youtube_songs.
        """
        songs = await self.repo.search(session, query_str=query)
        return await self._enrich_many(songs)

    async def search_youtube_songs(self, query: str) -> dict:
        results = await search_youtube(query=query)
        return {"results": results, "query": query}

    @staticmethod
    def _url_ttl(url: str) -> int:
        """Сколько ссылке осталось жить, по её же параметру expire.

        YouTube кладёт в ссылку unix-время протухания. Берём его, а не
        фиксированный срок: угадывать нельзя — отдадим просроченную ссылку,
        и воспроизведение упадёт на середине очереди.

        Вычитаем 10 минут про запас: между отдачей ссылки и нажатием play
        может пройти время, а трек ещё и играть должен до конца.
        """
        match = re.search(r"[?&]expire=(\d+)", url)
        if not match:
            return 1800  # параметра нет — держим полчаса, это заведомо безопасно

        remaining = int(match.group(1)) - int(time.time()) - 600
        return max(remaining, 0)

    async def stream_without_download(self, video_id: str) -> dict:
        """Ссылка на поток без сохранения в медиатеку.

        Результат кэшируется в Redis: извлечение занимает около двух секунд,
        а чтение из кэша — миллисекунды. При переходе по очереди это разница
        между паузой на каждом треке и мгновенным стартом.

        Возвращает объект, а не голую строку: мобильный клиент читает
        `response.stream_url ?? response.url` (см. streamUrls.ts), и на
        строке оба поля были бы undefined — приложение бросало бы ошибку
        даже при успешном ответе сервера.
        """
        redis = get_redis_client()
        key = f"ytstream:{video_id}"

        try:
            cached = await redis.get(key)
        except Exception:
            cached = None  # Redis лёг — не повод ронять воспроизведение

        if cached:
            return {"stream_url": cached, "duration": 0}

        url = await get_youtube_stream_url(video_id=video_id)

        ttl = self._url_ttl(url)
        if ttl > 0:
            try:
                await redis.setex(key, ttl, url)
            except Exception:
                pass  # не закэшировали — просто медленнее в следующий раз

        return {"stream_url": url, "duration": 0}

    async def is_liked(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        song_id: UUID,
    ) -> bool:
        return await self.repo.is_liked(session, user_id=user_id, song_id=song_id)

    async def add_like(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        song_id: UUID,
    ) -> dict:
        """Ставит лайк. Идемпотентно: повтор не ошибка и счётчик не двигает."""
        if await self.repo.get(session, song_id) is None:
            raise NotFoundError("Song", str(song_id))

        await self.repo.add_like(session, user_id=user_id, song_id=song_id)
        return {"song_id": song_id, "liked": True}

    async def remove_like(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        song_id: UUID,
    ) -> dict:
        """Снимает лайк. Тоже идемпотентно — «не было» не отличаем от «сняли»."""
        if await self.repo.get(session, song_id) is None:
            raise NotFoundError("Song", str(song_id))

        await self.repo.remove_like(session, user_id=user_id, song_id=song_id)
        return {"song_id": song_id, "liked": False}

    async def list_liked(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
    ) -> list[SongResponse]:
        song_ids = await self.repo.liked_ids(session, user_id=user_id)
        if not song_ids:
            return []

        songs = [await self.repo.get(session, song_id) for song_id in song_ids]
        return await self._enrich_many([song for song in songs if song is not None])



song_service = SongService(repo=song_repository)