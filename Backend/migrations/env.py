import asyncio

from alembic import context
from sqlalchemy.engine import Connection, URL

from app.infra.core.config import Config
from app.infra.database.base import Base
from app.infra.database import models  # Register persistence tables for autogeneration.
from app.infra.database.connection import (
    configured_database_url,
    create_database_engine,
    validate_database_url,
)

config = context.config
target_metadata = Base.metadata


def migration_url() -> URL:
    supplied = config.attributes.get("database_url")
    if supplied is None:
        return configured_database_url(Config())
    if not isinstance(supplied, (str, URL)):
        raise ValueError("Migration database_url must be a PostgreSQL URL")
    return validate_database_url(supplied)


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = create_database_engine(migration_url(), pooling=False)
    try:
        async with engine.connect() as connection:
            await connection.run_sync(do_run_migrations)
    finally:
        await engine.dispose()


if context.is_offline_mode():
    context.configure(
        url=migration_url(), target_metadata=target_metadata,
        literal_binds=True, dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    connection = config.attributes.get("connection")
    if connection is None:
        asyncio.run(run_async_migrations())
    elif isinstance(connection, Connection):
        do_run_migrations(connection)
    else:
        raise ValueError("Migration connection must be a SQLAlchemy Connection")
