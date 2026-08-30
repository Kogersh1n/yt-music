import logging
from email.message import EmailMessage
from functools import lru_cache
from smtplib import SMTP, SMTPException

from pydantic import EmailStr

from src.integrations.smtp.config import SMTPSettings

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
            with SMTP(self.settings.HOST, self.settings.PORT) as server:
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
            
        except SMTPException:
            logging.warning("Failed to send message")


@lru_cache
def get_smtp_client() -> SMTPClient:
    return SMTPClient(SMTPSettings())        