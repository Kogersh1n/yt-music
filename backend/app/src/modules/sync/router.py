from fastapi import APIRouter, Query

from src.core.deps import SessionDep, UserDep
from src.modules.sync.schemas import Recommendation, SyncStatus, WantedTrack
from src.modules.sync.service import sync_service

sync_router = APIRouter(prefix="/sync", tags=["sync"])


@sync_router.get("/status", response_model=SyncStatus)
async def sync_status(session: SessionDep, user: UserDep):
    """Сколько треков в лайках, сколько уже скачано, сколько осталось."""
    return await sync_service.status(session)


@sync_router.get("/wanted", response_model=list[WantedTrack])
async def wanted_tracks(
    session: SessionDep,
    user: UserDep,
    limit: int = Query(default=500, ge=1, le=2000),
):
    """Список того, что домашнему воркеру нужно скачать.

    Сервер сам этого сделать не может — ютуб блокирует адреса
    дата-центров, см. docs/youtube-block.md.
    """
    return await sync_service.wanted(session, limit=limit)


@sync_router.get("/recommendations", response_model=list[Recommendation])
async def recommendations(
    session: SessionDep,
    user: UserDep,
    seeds: int = Query(default=15, ge=1, le=50),
    limit: int = Query(default=30, ge=1, le=100),
):
    """Что послушать дальше — на основе того, что уже в медиатеке.

    Авторизация в YouTube Music не требуется: «радио по треку» публично.
    Чем выше score, тем на большее число твоих треков похож кандидат.
    """
    return await sync_service.recommendations(
        session, user_id=user.id, seeds=seeds, limit=limit
    )
