from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.plays.repository import PlayEventRepository, play_event_repo
from src.modules.plays.schemas import PlayEventCreate, PlayEventResponse


class PlayEventService:
    """Журнал прослушиваний.

    Слой тонкий: вся содержательная работа — идемпотентная вставка —
    живёт в репозитории. Здесь только перевод результата в схему ответа.
    """

    def __init__(self, repo: PlayEventRepository) -> None:
        self.repo = repo

    async def ingest(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        events: list[PlayEventCreate],
    ) -> PlayEventResponse:
        accepted, duplicates = await self.repo.ingest(
            session, user_id=user_id, events=events
        )
        return PlayEventResponse(accepted=accepted, duplicates=duplicates)

    async def seeds_for_recommendations(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        limit: int = 20,
    ) -> list[tuple[str, str]]:
        """Треки, от которых строить рекомендации: (youtube_id, название).

        Отдельный метод, чтобы `sync` вызывал его, а не лез запросом
        в чужую таблицу: как устроен play_event — дело этого модуля.
        """
        return await self.repo.recent_completed(session, user_id=user_id, limit=limit)


play_event_service = PlayEventService(repo=play_event_repo)
