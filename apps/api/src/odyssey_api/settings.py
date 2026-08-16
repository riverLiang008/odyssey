from functools import lru_cache
from pathlib import Path
from uuid import UUID

from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parents[2]
REPOSITORY_ROOT = API_ROOT.parents[1]
REPOSITORY_ENV_FILE = REPOSITORY_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Keep configuration independent of the shell's current working directory.
        # The repository-root .env is the single documented local configuration source.
        env_file=REPOSITORY_ENV_FILE,
        env_prefix="ODYSSEY_",
        extra="ignore",
    )

    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://odyssey:odyssey@localhost:5432/odyssey"
    development_workspace_id: UUID | None = None
    development_workspace_name: str = "Odyssey Development"
    cors_origins: list[AnyHttpUrl] = [
        AnyHttpUrl("http://localhost:5173"),
        AnyHttpUrl("http://127.0.0.1:5173"),
    ]

    def normalized_cors_origins(self) -> list[str]:
        return [str(origin).rstrip("/") for origin in self.cors_origins]

    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "odyssey"
    s3_secret_key: str = "odyssey-local-secret"
    s3_bucket: str = "odyssey"


@lru_cache
def get_settings() -> Settings:
    return Settings()
