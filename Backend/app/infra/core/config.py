"""
Application configuration and settings.
"""

from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings


class Config(BaseSettings):
    """Application configuration settings."""

    # Settings can be loaded offline; the serving lifespan requires DATABASE_URL.
    database_url: SecretStr | None = Field(default=None, alias="DATABASE_URL")

    # Opaque session policy. Existing sessions retain their issued lifetimes.
    session_idle_seconds: int = Field(default=1800, gt=0, le=2147483647, alias="SESSION_IDLE_SECONDS")
    session_absolute_seconds: int = Field(default=43200, gt=0, le=2147483647, alias="SESSION_ABSOLUTE_SECONDS")
    remember_session_idle_seconds: int = Field(default=604800, gt=0, le=2147483647, alias="REMEMBER_SESSION_IDLE_SECONDS")
    remember_session_absolute_seconds: int = Field(default=2592000, gt=0, le=2147483647, alias="REMEMBER_SESSION_ABSOLUTE_SECONDS")

    # Registration-only technical defaults; not account/product quotas.
    registration_ip_limit: int = Field(
        default=5, gt=0, le=2147483646, alias="REGISTRATION_IP_LIMIT"
    )
    registration_window_seconds: int = Field(
        default=600, gt=0, alias="REGISTRATION_WINDOW_SECONDS"
    )
    registration_max_body_bytes: int = Field(
        default=8192, gt=0, alias="REGISTRATION_MAX_BODY_BYTES"
    )

    # JWT Configuration
    secret_key: str = Field(
        default="09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7",
        alias="SECRET_KEY",
    )
    algorithm: str = Field(default="HS256", alias="ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=30, alias="ACCESS_TOKEN_EXPIRE_MINUTES"
    )

    # Refresh token configuration
    refresh_token_expire_days: int = Field(default=7, alias="REFRESH_TOKEN_EXPIRE_DAYS")

    default_pagination_limit: int = Field(default=10, alias="DEFAULT_PAGINATION_LIMIT")

    # Static files paths
    permissions_path: str = Field(
        default=str(
            Path(__file__).parent.parent.parent.parent / "statics" / "permissions.json"
        ),
        alias="PERMISSIONS_PATH",
    )
    policies_path: str = Field(
        default=str(
            Path(__file__).parent.parent.parent.parent / "statics" / "policies.json"
        ),
        alias="POLICIES_PATH",
    )

    model_config = {
        "populate_by_name": True,
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


# Global instance of the configuration
config = Config()
