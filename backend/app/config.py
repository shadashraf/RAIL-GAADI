from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = Field(default="Train Delay Intelligence")
    app_env: str = Field(default="development")
    debug: bool = Field(default=True)
    database_url: str = Field(default="sqlite:///./train_delay.db")
    secret_key: str = Field(default="change-me-in-production")
    algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=60)
    railradar_api_key: str | None = Field(default=None)
    live_api_url: str | None = Field(default=None)
    api_access_key: str | None = Field(default=None)
    cors_origins: str = Field(
        default=(
            "https://rail-gaadi-eta.web.app,https://rail-gaadi-eta.firebaseapp.com,"
            "http://localhost:5173,http://127.0.0.1:5173"
        )
    )
    trusted_hosts: str = Field(default="localhost,127.0.0.1")
    db_pool_size: int = Field(default=5, ge=1)
    db_max_overflow: int = Field(default=10, ge=0)

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug_flag(cls, value):
        if isinstance(value, bool):
            return value
        if value is None:
            return False
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "prod", "production"}:
                return False
        return value

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() in {"dev", "development", "local"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def trusted_host_list(self) -> list[str]:
        required_hosts = [
            "rail-gaadi-backend.onrender.com",
            "localhost",
            "127.0.0.1",
        ]
        configured_hosts = [host.strip().lower() for host in self.trusted_hosts.split(",")]
        return list(dict.fromkeys(
            host for host in [*required_hosts, *configured_hosts] if host and host != "*"
        ))


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
