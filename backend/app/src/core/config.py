from pydantic import EmailStr,SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file = '.env',
        extra = 'ignore'
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
    R2_SONGS_BUCKET: str
    R2_COVERS_BUCKET: str
    R2_AVATARS_BUCKET: str | None = None
    R2_LOCAL_ENDPOINT: str | None = None
    R2_INTERNAL_ENDPOINT: str | None = None


    @property
    def r2_endpoint_url(self) -> str:
        if self.R2_LOCAL_ENDPOINT:
            return self.R2_LOCAL_ENDPOINT

        return f"https://{self.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

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
    
