from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.auth.session_models import SessionPolicy
from app.application.use_cases.auth.session_service import SessionService
from app.infra.core.config import Config
from app.infra.repositories.postgres.session_repository import SQLSessionRepository
from app.infra.services.session_token_service import OpaqueSessionTokens
from app.interface.dependencies.database_dependencies import get_database_session
from app.interface.repository.session_repository_interface import ISessionRepository


def session_policy(settings: Config) -> SessionPolicy:
    return SessionPolicy(idle_seconds=settings.session_idle_seconds,
        absolute_seconds=settings.session_absolute_seconds,
        remember_idle_seconds=settings.remember_session_idle_seconds,
        remember_absolute_seconds=settings.remember_session_absolute_seconds)


async def get_session_repository(session: AsyncSession = Depends(get_database_session)) -> ISessionRepository:
    return SQLSessionRepository(session)


def get_session_service(request: Request, repository: ISessionRepository = Depends(get_session_repository)) -> SessionService:
    return SessionService(repository, OpaqueSessionTokens(), session_policy(request.app.state.settings))
