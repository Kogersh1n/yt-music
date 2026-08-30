from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.integrations.ytmusic import client as ytmusic
from src.modules.songs.models import Song
from src.modules.sync.schemas import Recommendation, SyncStatus, WantedTrack


class SyncService:
    """Сверка библиотеки YouTube Music с тем, что уже лежит в хранилище.

    Сам ничего не качает: сервер заблокирован ютубом. Задача сервиса —
    сказать домашнему воркеру, чего не хватает, а тот уже скачает
    со своего адреса и зальёт в R2.
    """

    @staticmethod
    async def _downloaded_ids(session: AsyncSession) -> set[str]:
        rows = await session.execute(
            select(Song.youtube_id).where(Song.youtube_id.is_not(None))
        )
        return set(rows.scalars().all())

    async def wanted(
        self,
        session: AsyncSession,
        *,
        limit: int = 500,
    ) -> list[WantedTrack]:
        liked = ytmusic.liked_songs(limit=limit)
        have = await self._downloaded_ids(session)

        return [
            WantedTrack(
                video_id=t.video_id,
                title=t.title,
                author=t.author,
                duration=t.duration,
                cover=t.cover,
            )
            for t in liked
            if t.video_id not in have
        ]

    async def status(self, session: AsyncSession) -> SyncStatus:
        """Состояние синхронизации.

        `authenticated` означает «библиотека реально читается», а не просто
        «файл на месте». Разница важна: файл с неполными заголовками
        существует, но ничего не отдаёт — и статус, говорящий «всё хорошо»,
        сбивал бы с толку.
        """
        have = await self._downloaded_ids(session)

        if not ytmusic.is_authenticated():
            return SyncStatus(
                authenticated=False, liked_total=0, in_library=len(have), wanted=0
            )

        try:
            liked = ytmusic.liked_songs(limit=500)
        except Exception:
            # Файл есть, но нерабочий: истёк, неполный, отозван.
            return SyncStatus(
                authenticated=False, liked_total=0, in_library=len(have), wanted=0
            )

        missing = [t for t in liked if t.video_id not in have]

        return SyncStatus(
            authenticated=True,
            liked_total=len(liked),
            in_library=len(have),
            wanted=len(missing),
        )

    async def recommendations(
        self,
        session: AsyncSession,
        *,
        seeds: int = 15,
        limit: int = 30,
    ) -> list[Recommendation]:
        """Рекомендации на основе того, что уже в медиатеке.

        Для каждого трека спрашиваем у YouTube Music похожие и считаем,
        сколько раз каждый кандидат встретился. Частота — простой, но
        осмысленный признак: если песня оказалась похожей сразу на
        несколько твоих, она вероятнее попадёт во вкус, чем случайная
        из выдачи по одной.

        Авторизация не нужна: «радио по треку» — публичная выдача.
        """
        rows = await session.execute(
            select(Song).where(Song.youtube_id.is_not(None)).limit(seeds)
        )
        library = list(rows.scalars().all())
        if not library:
            return []

        have = {song.youtube_id for song in library}
        have |= await self._downloaded_ids(session)

        scores: dict[str, dict] = {}

        for song in library:
            try:
                related = ytmusic.related_tracks(song.youtube_id, limit=20)
            except Exception:
                # Один недоступный трек не должен ронять весь подбор.
                continue

            for candidate in related:
                if candidate.video_id in have:
                    continue

                entry = scores.get(candidate.video_id)
                if entry is None:
                    scores[candidate.video_id] = {
                        "track": candidate,
                        "score": 1,
                        "because_of": song.title,
                    }
                else:
                    entry["score"] += 1

        ranked = sorted(scores.values(), key=lambda e: e["score"], reverse=True)

        return [
            Recommendation(
                video_id=e["track"].video_id,
                title=e["track"].title,
                author=e["track"].author,
                duration=e["track"].duration,
                cover=e["track"].cover,
                score=e["score"],
                because_of=e["because_of"],
            )
            for e in ranked[:limit]
        ]


sync_service = SyncService()
