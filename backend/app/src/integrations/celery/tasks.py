import logging
from smtplib import SMTPException

from src.integrations.celery.client import celery_app
from src.integrations.smtp.client import get_smtp_client

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    # Повторяем только то, что чинится временем: обрывы связи и таймауты.
    # Постоянные отказы (неверный адрес, отклонённый отправитель, ошибка
    # входа) SMTPClient превращает в ExternalServiceError — его в списке
    # нет, и задача падает сразу, не насилуя сервер четыре раза подряд.
    autoretry_for=(SMTPException, OSError),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=4,
)
def send_email(self, email_to: str, subject: str, content: str) -> None:
    """Отправка письма.

    Исключения намеренно не подавляются. Раньше SMTPClient глотал их
    с записью «Failed to send message» без причины: celery рапортовал
    об успехе, письмо не уходило, и о сломанной почте можно было узнать
    только по жалобам пользователей.
    """
    smtp_client = get_smtp_client()
    smtp_client.send_email(email_to, subject, content)
