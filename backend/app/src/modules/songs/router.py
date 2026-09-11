from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from src.core.deps import SessionDep, UserDep
from src.modules.songs.schemas import (
    SongCoverResponse,
    SongCreate,
    SongPaginationResponse,
    SongResponse,
    SongStreamResponse,
    SongYoutubeImport,
    UploadCredentialsResponse,
    YouTubeSearchResponse,
)
from src.modules.songs.service import song_service
from src.modules.songs.utils import SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT

songs_router = APIRouter(prefix='/songs', tags=['song'])


# ──────────────────────────────────────────────────────────────────────────
# Кто и что может
#
# Правило простое: всё, что меняет данные или тратит деньги, требует входа.
# Чтение пока открыто.
#
# Почему именно так. Раньше вход не требовался нигде, и это проверялось
# не рассуждением, а запросом: `curl -X DELETE /songs/{id}` без единого
# заголовка возвращал 200 и действительно удалял трек. Адрес сервера лежит
# в открытом APK, то есть догадываться было не о чем.
#
# Отдельно про выдачу ссылок на заливку: она даёт право писать в приватное
# хранилище. Это не утечка данных, это чужие файлы за твой счёт — самый
# дорогой из открытых путей.
#
# Чтение оставлено открытым сознательно, а не по недосмотру: приложение
# показывает медиатеку до входа, и закрытие чтения сломало бы первый запуск.
# Когда появится разделение медиатек по пользователям, закрывать надо будет
# и его — сейчас медиатека одна на всех, и прятать в ней нечего.
# ──────────────────────────────────────────────────────────────────────────


# ─── Заливка своих файлов ────────────────────────────────────────────────
#
# Файл идёт в хранилище напрямую с устройства, минуя бэкенд: тот лишь
# подписывает адрес. Иначе каждый трек шёл бы через сервер дважды —
# вверх от клиента и вниз в хранилище, — а это его канал и его память.

@songs_router.get('/upload-url', response_model=UploadCredentialsResponse)
async def upload_url(user: UserDep, filename: str, file_type: str):
    return await song_service.get_upload_credentials(filename=filename, file_type=file_type)


@songs_router.get('/upload-cover-url', response_model=UploadCredentialsResponse)
async def upload_cover(user: UserDep, filename: str, file_type: str):
    # Раньше здесь стоял SongCoverResponse ({cover_url}), а сервис отдаёт
    # {upload_url, file_key} — ответ не проходил валидацию, и ручка падала.
    return await song_service.get_cover_upload_credentials(
        filename=filename, file_type=file_type
    )


# ─── Медиатека ───────────────────────────────────────────────────────────

@songs_router.get('/search', response_model=list[SongResponse])
async def search(session: SessionDep, q: str = Query(min_length=1)):
    """Поиск по своей медиатеке. Поиск по ютубу — /songs/youtube/search."""
    return await song_service.search_library(session, query=q)


@songs_router.get('/liked', response_model=list[SongResponse])
async def liked_songs(session: SessionDep, user: UserDep):
    return await song_service.list_liked(session, user_id=user.id)


@songs_router.post('/', response_model=SongResponse, status_code=status.HTTP_201_CREATED)
async def song_create(session: SessionDep, user: UserDep, song_in: SongCreate):
    """Создать запись о песне после того, как файлы уже в хранилище.

    Запись создаётся последней в цепочке импорта намеренно: если что-то
    сорвётся раньше, в медиатеке не появится строки, ведущей в никуда.
    """
    return await song_service.create_song(session=session, song_in=song_in)


@songs_router.get('/', response_model=SongPaginationResponse)
async def get_all_songs(
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    cursor: Annotated[str | None, Query(description='Base64 encoded cursor')] = None,
):
    return await song_service.get_all_songs(session=session, limit=limit, cursor=cursor)


@songs_router.post('/import/youtube')
async def import_from_youtube(
    session: SessionDep, user: UserDep, import_data: SongYoutubeImport
):
    """Импорт силами сервера.

    Приложение этой ручкой больше не пользуется: YouTube отклоняет адреса
    дата-центров, и замер дал один успех из восьми. Скачивает теперь телефон
    (mobile/src/features/importTrack.ts) — у него обычный домашний адрес.

    Ручка оставлена как запасной путь и как способ добавить трек не с телефона.
    """
    return await song_service.import_from_youtube(session=session, url=import_data.query)


# ─── YouTube ─────────────────────────────────────────────────────────────

@songs_router.get('/youtube/search', response_model=YouTubeSearchResponse)
async def youtube_search(
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(SEARCH_DEFAULT_LIMIT, ge=1, le=SEARCH_MAX_LIMIT),
):
    return await song_service.search_youtube_songs(query=q, limit=limit)


@songs_router.get('/youtube/stream/{video_id}', response_model=SongStreamResponse)
async def stream_without_saving(video_id: str):
    """Ссылка на поток без сохранения — «послушать сейчас».

    Работает примерно в четверти случаев: с адреса дата-центра YouTube
    отвечает бот-проверкой. Приложение сначала пробует достать ссылку само
    и приходит сюда только при неудаче.
    """
    return await song_service.stream_without_download(video_id=video_id)


# ─── Одна песня ──────────────────────────────────────────────────────────

@songs_router.get('/{song_id}', response_model=SongResponse)
async def get_song(session: SessionDep, song_id: UUID):
    return await song_service.get_song(session=session, song_id=song_id)


@songs_router.delete('/{song_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_song(session: SessionDep, user: UserDep, song_id: UUID):
    await song_service.delete_song(session=session, song_id=song_id)


@songs_router.get('/{song_id}/stream', response_model=SongStreamResponse)
async def get_stream(session: SessionDep, song_id: UUID):
    return await song_service.get_stream_url(session=session, song_id=song_id)


@songs_router.get('/{song_id}/cover', response_model=SongCoverResponse)
async def get_cover(session: SessionDep, song_id: UUID):
    return await song_service.get_cover_url(session=session, song_id=song_id)


# ─── Лайки ───────────────────────────────────────────────────────────────

@songs_router.post('/{song_id}/like')
async def add_like(session: SessionDep, user: UserDep, song_id: UUID):
    return await song_service.add_like(session, user_id=user.id, song_id=song_id)


@songs_router.delete('/{song_id}/like')
async def remove_like(session: SessionDep, user: UserDep, song_id: UUID):
    return await song_service.remove_like(session, user_id=user.id, song_id=song_id)
