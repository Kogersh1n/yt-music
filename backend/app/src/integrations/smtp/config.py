from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class SMTPSettings(BaseSettings):
    """Конфигурация почты. Читает переменные с префиксом SMTP_.

    HOST -> SMTP_HOST, SENDER -> SMTP_SENDER и так далее.
    USERNAME/PASSWORD пустые по умолчанию: локальные почтовые
    заглушки (mailhog, maildev) работают без авторизации, а
    SMTPClient пропускает login при пустом USERNAME.
    """

    model_config = SettingsConfigDict(
        env_file=('.env', '../.env'),
        env_prefix='SMTP_',
        extra='ignore',
    )

    HOST: str
    PORT: int = 587
    USERNAME: str = ''
    PASSWORD: SecretStr = SecretStr('')
    SENDER: str
    USE_TLS: bool = True
