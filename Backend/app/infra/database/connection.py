from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.infra.core.config import Config


def validate_database_url(value: str | URL) -> URL:
    """Require an explicit PostgreSQL/psycopg target without echoing a secret DSN."""
    try:
        url = make_url(value)
    except (ArgumentError, ValueError):
        raise ValueError("DATABASE_URL must be a valid PostgreSQL URL") from None
    if url.drivername != "postgresql+psycopg" or not url.host or not url.database:
        raise ValueError("DATABASE_URL requires postgresql+psycopg, a host and a database")
    return url


def configured_database_url(settings: Config) -> URL:
    if settings.database_url is None or not settings.database_url.get_secret_value():
        raise ValueError("DATABASE_URL is required for PostgreSQL operations")
    return validate_database_url(settings.database_url.get_secret_value())


def create_database_engine(value: str | URL, *, pooling: bool = True) -> AsyncEngine:
    url = validate_database_url(value)
    return create_async_engine(
        url,
        pool_pre_ping=True,
        hide_parameters=True,
        connect_args={"connect_timeout": 5},
        **({} if pooling else {"poolclass": NullPool}),
    )


class Database:
    """Own the pool; give each use-case operation its own session/transaction."""

    def __init__(self, url: str | URL) -> None:
        self.engine = create_database_engine(url)
        self._sessions = async_sessionmaker(self.engine, expire_on_commit=False)

    @classmethod
    def from_config(cls, settings: Config) -> "Database":
        return cls(configured_database_url(settings))

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[AsyncSession]:
        # SQLAlchemy commits on success, rolls back on errors/cancellation, and closes.
        async with self._sessions.begin() as session:
            yield session

    async def dispose(self) -> None:
        await self.engine.dispose()
