from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.repository import BaseRepository
from src.modules.plays.models import PlayEvent
from src.modules.plays.schemas import PlayEventCreate


class PlayEventRepository(
    # Третий параметр — схема обновления. У журнала её нет: события
    # только дописываются и читаются, поштучно их никто не правит.
    # Подставлена та же схема создания, чтобы удовлетворить дженерик.
    BaseRepository[PlayEvent, PlayEventCreate, PlayEventCreate]
):
    def __init__(self) -> None:
        super().__init__(PlayEvent)

    async def ingest(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        events: list[PlayEventCreate],
    ) -> tuple[int, int]:
        """Записывает пачку событий. Возвращает (принято, дублей).

        Телефон отправляет журнал пачками и повторит отправку при обрыве
        связи: подтверждение может не дойти уже после того, как сервер
        записал. Поэтому вставка идемпотентна — конфликт по уникальному
        ограничению просто игнорируется.

        Без этого одно прослушивание записалось бы дважды, и трек,
        который слушали при плохой сети, получил бы двойной вес
        в рекомендациях и в рекапе.
        """
        if not events:
            return 0, 0

        # user_id подмешивается здесь, а не приходит из тела запроса:
        # иначе кто угодно смог бы писать в чужую историю.
        values = [event.model_dump() | {"user_id": user_id} for event in events]

        stmt = (
            pg_insert(PlayEvent)
            .values(values)
            # По имени ограничения, а не по списку колонок: переименуешь
            # колонки — получишь явную ошибку, а не тихо потерявшуюся защиту.
            .on_conflict_do_nothing(constraint="play_event_unique")
        )

        # Один запрос на всю пачку. Цикл из 500 отдельных INSERT — это
        # 500 обращений к базе вместо одного.
        result = await session.execute(stmt)

        accepted = result.rowcount or 0
        return accepted, len(events) - accepted

    async def recent_completed(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        limit: int = 20,
    ) -> list[tuple[str, str]]:
        """Недавно дослушанные треки с ютуба: (youtube_id, название).

        Это семена для рекомендаций: от чего строить «радио». Берём
        только дослушанные — пропуск означает, что не зашло, и строить
        от него похожие бессмысленно.

        Свежие первыми: вкус меняется, и то, что слушали вчера,
        описывает его точнее, чем то, что месяц назад.

        Работает по индексу (user_id, started_at) — ради этого запроса
        он и заводился.
        """
        stmt = (
            select(PlayEvent.youtube_id, PlayEvent.title)
            .where(
                PlayEvent.user_id == user_id,
                PlayEvent.completed.is_(True),
                PlayEvent.youtube_id.is_not(None),
            )
            .order_by(PlayEvent.started_at.desc())
            .limit(limit * 4)
        )

        rows = await session.execute(stmt)

        # Уникальность наводим в питоне, а не через DISTINCT: с ORDER BY
        # постгресу пришлось бы сортировать весь результат целиком,
        # а так он читает по индексу и останавливается, набрав нужное.
        seen: dict[str, str] = {}
        for youtube_id, title in rows:
            if youtube_id not in seen:
                seen[youtube_id] = title
                if len(seen) >= limit:
                    break

        return list(seen.items())


play_event_repo = PlayEventRepository()
