from pydantic import EmailStr,SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file = '.env'
    )

    DEBUG: bool = False

    ALLOWED_HOSTS: list[str]
    CORE_ORIGINS: list[str]

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

    REDIS_HOST: str
    REDIS_PORT: int
    REDIS_DB: int
    REDIS_PASSWORD: SecretStr

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
    
