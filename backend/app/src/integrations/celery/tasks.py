import asyncio
import logging

from src.integrations.celery.client import celery_app
from src.integrations.smtp.client import get_smtp_client

logger = logging.getLogger(__name__)


@celery_app.task()
def send_email(email_to: str, subject: str, content: str) -> None:
    smtp_client = get_smtp_client()
    smtp_client.send_email(email_to, subject, content)


@celery_app.task(name="sync_recommendations")
def sync_recommendations(limit: int = 5) -> str:
    """Ночное пополнение медиатеки.

    Берёт рекомендации по тому, что уже есть, и докачивает несколько
    новых треков в хранилище. Скачивание идёт через WARP — напрямую
    YouTube этот сервер не пускает, см. docs/youtube-block.md.

    Ограничение по количеству намеренно скромное: смысл в том, чтобы
    медиатека росла понемногу каждый день, а не чтобы за одну ночь
    залить тысячу случайных треков.
    """
    return asyncio.run(_sync_recommendations(limit))


async def _sync_recommendations(limit: int) -> str:
    from src.db.engine import async_session_maker
    from src.modules.songs.service import song_service
    from src.modules.sync.service import sync_service

    added, failed = 0, 0

    async with async_session_maker() as session:
        try:
            picks = await sync_service.recommendations(session, seeds=15, limit=limit)
        except Exception as exc:
            logger.warning("не удалось получить рекомендации: %s", exc)
            return "recommendations unavailable"

        if not picks:
            return "nothing to add"

        for pick in picks:
            url = f"https://www.youtube.com/watch?v={pick.video_id}"
            try:
                await song_service.import_from_youtube(session=session, url=url)
                await session.commit()
                added += 1
                logger.info("добавлен %s — %s", pick.author, pick.title)
            except Exception as exc:
                # Возрастные ограничения, удалённые ролики, сбои сети —
                # один отказ не должен останавливать всю ночную задачу.
                await session.rollback()
                failed += 1
                logger.info(
                    "пропущен %s: %s", pick.video_id, str(exc).splitlines()[0][:100]
                )

    return f"added={added} failed={failed}"
