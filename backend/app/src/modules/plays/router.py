from fastapi import APIRouter

from src.core.deps import SessionDep, UserDep
from src.core.exceptions import BadRequestError
from src.modules.plays.schemas import PlayEventCreate, PlayEventResponse
from src.modules.plays.service import play_event_service

plays_router = APIRouter(prefix="/plays", tags=["plays"])

# Потолок на пачку. Телефон шлёт журнал накопленными порциями, и без
# ограничения одна отправка после долгого офлайна могла бы прийти
# на десятки тысяч событий — это и память, и время запроса.
MAX_BATCH = 500


@plays_router.post("/batch", response_model=PlayEventResponse)
async def upload_batch(
    events: list[PlayEventCreate],
    session: SessionDep,
    user: UserDep,
):
    """Принимает журнал прослушиваний с устройства.

    Идемпотентно: повторная отправка той же пачки не создаёт дублей,
    в ответе видно, сколько записалось, а сколько отсеялось.
    """
    if len(events) > MAX_BATCH:
        raise BadRequestError(f"За раз не больше {MAX_BATCH} событий")

    return await play_event_service.ingest(session, user_id=user.id, events=events)
