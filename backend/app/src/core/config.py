from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file = ('.env', '../.env'),
        # SMTP_* читает SMTPSettings, а не этот класс — без ignore
        # pydantic отвергает их как лишние поля из .env
        extra = 'ignore',
    )

    DEBUG: bool = False

    ALLOWED_HOSTS: list[str]
    CORS_ORIGINS: list[str]

    SECRET_KEY: SecretStr
    
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_SECONDS: int = 60 * 30  
    REFRESH_TOKEN_EXPIRE_SECONDS: int = 60 * 60 * 24 * 30
    VERIFICATION_CODE_EXPIRE_SECONDS: int = 60 * 10
    PASSWORD_RESET_TOKEN_EXPIRE_SECONDS: int = 60 * 10

    # Файл авторизации YouTube Music (ytmusicapi browser).
    # Без него доступен только открытый поиск, личная библиотека — нет.
    YTMUSIC_AUTH_FILE: str | None = None

    # --- Доступ к YouTube ---
    # Файл cookies в формате Netscape. Нужен, когда YouTube требует
    # подтверждения «я не робот» — так бывает с IP дата-центров.
    # Путь внутри контейнера; если файла нет, параметр просто не передаётся.
    YTDLP_COOKIES_FILE: str | None = None
    # Прокси для запросов к YouTube, например socks5://user:pass@host:1080.
    # Нужен резидентный или мобильный: датацентровые заблокированы так же,
    # как и сам сервер.
    YTDLP_PROXY: str | None = None

    DB_HOST: str
    DB_PORT: int
    DB_USER: SecretStr
    DB_PASSWORD: SecretStr
    DB_NAME: str

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: SecretStr | None = None

    R2_ACCOUNT_ID: str
    R2_ACCESS_KEY_ID: str
    R2_SECRET_ACCESS_KEY: str
    R2_BUCKET: str
    R2_PUBLIC_ENDPOINT_URL: str | None = None
    R2_ENDPOINT_URL: str | None = None
    R2_PRESIGNED_URL_EXPIRE_SECONDS: int = 3600
    R2_TRACKS_PREFIX: str = "tracks"
    R2_COVERS_PREFIX: str = "covers"

    @property
    def r2_endpoint_url(self) -> str:
        if self.R2_ENDPOINT_URL:
            return self.R2_ENDPOINT_URL

        return f"https://{self.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    
    @property
    def r2_public_endpoint_url(self) -> str:
        """URL, который получит браузер. Для local dev = http://localhost:9000"""
        return self.R2_PUBLIC_ENDPOINT_URL or self.r2_endpoint_url

    @property
    def redis_url(self) -> str:
        """URL для celery-брокера и любых клиентов, ожидающих строку."""
        auth = (
            f":{self.REDIS_PASSWORD.get_secret_value()}@"
            if self.REDIS_PASSWORD
            else ""
        )
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    @property
    def db_url(self) -> URL:
        return URL.create(
            drivername='postgresql+asyncpg',
            username=self.DB_USER.get_secret_value(),
            password=self.DB_PASSWORD.get_secret_value(),
            host=self.DB_HOST,
            port=self.DB_PORT,
            database=self.DB_NAME,
        )
    
    @property
    def sync_db_url(self) -> URL:
        return URL.create(
            drivername="postgresql+psycopg",
            username=self.DB_USER.get_secret_value(),
            password=self.DB_PASSWORD.get_secret_value(),
            host=self.DB_HOST,
            port=self.DB_PORT,
            database=self.DB_NAME,
        )

settings = Settings()
    
