import logging
from email.message import EmailMessage
from functools import lru_cache
from smtplib import (
    SMTP,
    SMTPAuthenticationError,
    SMTPException,
    SMTPRecipientsRefused,
    SMTPSenderRefused,
)

from pydantic import EmailStr

from src.core.exceptions import ExternalServiceError
from src.integrations.smtp.config import SMTPSettings

logger = logging.getLogger(__name__)

# Отказы, которые не лечатся повтором.
PERMANENT_FAILURES = (
    SMTPRecipientsRefused,
    SMTPSenderRefused,
    SMTPAuthenticationError,
)


class SMTPClient:
    def __init__(self, settings: SMTPSettings):
        self.settings = settings

    def send_email(
            self,
            email_to: EmailStr,
            subject: str,
            content: str
        ) -> None:
        msg = EmailMessage()
        msg.set_content(content)
        msg["Subject"] = subject
        msg["From"] = self.settings.SENDER
        msg["To"] = email_to

        try:
            with SMTP(self.settings.HOST, self.settings.PORT, timeout=30) as server:
                server.ehlo()

                if server.has_extn("STARTTLS"):
                    server.starttls()
                    server.ehlo()

                if self.settings.USERNAME and server.has_extn("AUTH"):
                    server.login(
                        self.settings.USERNAME,
                        self.settings.PASSWORD.get_secret_value(),
                    )
                server.send_message(msg)

        except PERMANENT_FAILURES as exc:
            # Повторять бессмысленно: неверный адрес, отклонённый отправитель
            # или неправильные учётные данные сами не починятся.
            logger.error(
                "письмо на %s отклонено сервером: %s", email_to, exc, exc_info=True
            )
            raise ExternalServiceError("SMTP", str(exc)[:200]) from exc

        except (SMTPException, OSError) as exc:
            # Обрыв связи, таймаут, недоступный хост — повторная попытка
            # имеет смысл, поэтому исключение уходит наверх: celery-задача
            # поймает его и переотправит с задержкой.
            #
            # Раньше здесь стоял `logging.warning("Failed to send message")`
            # без причины и без проброса: задача рапортовала об успехе,
            # письмо не уходило, и узнать об этом было неоткуда.
            logger.warning(
                "не удалось отправить письмо на %s: %s", email_to, exc, exc_info=True
            )
            raise


@lru_cache
def get_smtp_client() -> SMTPClient:
    return SMTPClient(SMTPSettings())        