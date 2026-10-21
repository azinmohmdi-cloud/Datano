from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi_pagination import add_pagination
from sqlalchemy import select
from sqlalchemy.exc import ProgrammingError
from starlette.types import Lifespan

from app.domain.error.exception_handlers import register_all_exception_handlers
from app.infra.core.add_middlewares import add_middlewares
from app.infra.core.config import Config, config
from app.infra.core.logging import register_logger
from app.infra.database.bootstrap import ensure_required_roles
from app.infra.database.connection import Database
from app.infra.database.models import RecoveryGrantRow, RegistrationAttemptRow, SessionRow
from app.interface.controller import api_router
from app.interface.dependencies.session_dependencies import session_policy
from app.infra.services.csrf_service import CsrfService
from app.interface.csrf import document_csrf
from app.infra.services.smtp_email_service import SMTPEmailSender


def create_app(
    settings: Config | None = None,
    *,
    lifespan_handler: Lifespan[FastAPI] | None = None,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        session_policy(application.state.settings)
        CsrfService.from_config(application.state.settings)
        # Validate enabled mail configuration before opening the database. No mail
        # is sent and no SMTP connection is made during application startup.
        email_sender = SMTPEmailSender(application.state.settings) if application.state.settings.smtp_enabled else None
        database = Database.from_config(settings if settings is not None else config)
        application.state.database = database
        application.state.email_sender = email_sender
        try:
            try:
                async with database.transaction() as session:
                    await ensure_required_roles(session)
                    await session.execute(select(RegistrationAttemptRow).limit(0))
                    await session.execute(select(SessionRow).limit(0))
                    await session.execute(select(RecoveryGrantRow).limit(0))
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
            del application.state.email_sender

    application = FastAPI(
        title="FastAPI Server", version="1.0.0", lifespan=lifespan_handler or lifespan
    )
    application.state.settings = settings if settings is not None else config
    register_logger(application)
    add_middlewares(application)
    register_all_exception_handlers(application)
    add_pagination(application)
    application.include_router(api_router)
    document_csrf(application)
    return application


app = create_app()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8004)
