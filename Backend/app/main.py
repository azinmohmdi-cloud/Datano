from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi_pagination import add_pagination
from sqlalchemy.exc import ProgrammingError
from starlette.types import Lifespan

from app.domain.error.exception_handlers import register_all_exception_handlers
from app.infra.core.add_middlewares import add_middlewares
from app.infra.core.config import Config, config
from app.infra.core.logging import register_logger
from app.infra.database.bootstrap import ensure_required_roles
from app.infra.database.connection import Database
from app.interface.controller import api_router


def create_app(
    settings: Config | None = None,
    *,
    lifespan_handler: Lifespan[FastAPI] | None = None,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        database = Database.from_config(settings if settings is not None else config)
        application.state.database = database
        try:
            try:
                async with database.transaction() as session:
                    await ensure_required_roles(session)
            except ProgrammingError as error:
                if getattr(error.orig, "sqlstate", None) in {"42P01", "42703"}:
                    raise RuntimeError(
                        "Database schema missing or outdated; run alembic upgrade head"
                    ) from None
                raise
            yield
        finally:
            await database.dispose()
            del application.state.database

    application = FastAPI(
        title="FastAPI Server", version="1.0.0", lifespan=lifespan_handler or lifespan
    )
    register_logger(application)
    add_middlewares(application)
    register_all_exception_handlers(application)
    add_pagination(application)
    application.include_router(api_router)
    return application


app = create_app()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8004)
