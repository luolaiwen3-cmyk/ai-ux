from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="INSIGHTUX_", env_file=REPO_ROOT / ".env", extra="ignore"
    )

    environment: str = "development"
    database_url: str = f"sqlite:///{REPO_ROOT / 'data' / 'insightux.sqlite3'}"
    data_dir: Path = REPO_ROOT / "data"
    frontend_dist: Path = REPO_ROOT / "frontend" / "dist"
    admin_username: str = "admin"
    admin_password_hash: str = "$argon2id$v=19$m=65536,t=3,p=4$EFNOGECJKs0HIhq3bJFOkw$m1bXlueXElILAeOCrbtIlAkVbvjyZWoyRyLsN6Lm1Ek"
    session_secret: str = "development-only-change-me"
    session_ttl_seconds: int = 8 * 60 * 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
