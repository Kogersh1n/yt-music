from functools import lru_cache

from pydantic import EmailStr

from src.integrations.celery.tasks import send_email
from src.integrations.smtp.client import SMTPClient, get_smtp_client

class EmailService:
    def __init__(self, smtp_client: SMTPClient) -> None:
        self.smtp_client = smtp_client

    def send_verification_email(self, email_to: EmailStr, code: str) -> None:
        send_email.delay(  # pyright: ignore[reportFunctionMemberAccess]
            email_to,
            "Verify your email",
            f"Your verification code is: {code}\n\nIf you didn't sign up for an account, please ignore this email.",
        )

    def send_password_reset_email(self, email_to: EmailStr, token: str) -> None:
        send_email.delay(
            email_to,
            "Reset your password",
            f"Your password reset token is: {token}\n\nIf you did not request a password reset, please ignore this email. Your password will remain unchanged.",
        )

@lru_cache
def get_email_service() -> EmailService:
    smtp_client = get_smtp_client()
    return EmailService(smtp_client)