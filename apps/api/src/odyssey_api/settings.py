from functools import lru_cache

from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_prefix="ODYSSEY_",
        extra="ignore",
    )

    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://odyssey:odyssey@localhost:5432/odyssey"
    cors_origins: list[AnyHttpUrl] = [AnyHttpUrl("http://localhost:5173")]
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "odyssey"
    s3_secret_key: str = "odyssey-local-secret"
    s3_bucket: str = "odyssey"


@lru_cache
def get_settings() -> Settings:
    return Settings()
