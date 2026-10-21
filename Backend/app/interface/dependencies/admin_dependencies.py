from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.auth.admin_policy import AdminEmailPolicy
from app.infra.repositories.postgres.admin_grant_repository import SQLAdminGrantRepository
from app.interface.dependencies.database_dependencies import get_database_session
from app.interface.repository.admin_grant_repository_interface import IAdminGrantRepository
from app.application.use_cases.auth.admin_email import AdminEmailService, invalid_admin_proof
from app.application.use_cases.auth.email import EmailDeliveryError
from app.application.use_cases.auth.email_codes import EmailCodeUnavailable
from app.domain.error.exceptions import ServiceUnavailableException
from app.infra.repositories.postgres.admin_proof_repository import PostgresAdminProofRepository
from app.infra.services.session_token_service import OpaqueSessionTokens
from app.interface.dependencies.email_code_dependencies import get_email_code_service
from app.interface.dependencies.session_dependencies import session_policy
from app.interface.session_cookie import SessionCredential, read_session_cookie


def get_admin_email_policy(request: Request) -> AdminEmailPolicy:
    value = request.app.state.settings.admin_email_allowlist
    return AdminEmailPolicy.parse(value.get_secret_value() if value is not None else None)


async def get_admin_grant_repository(session: AsyncSession = Depends(get_database_session)) -> IAdminGrantRepository:
    return SQLAdminGrantRepository(session)


def get_admin_email_service(request: Request, credential: SessionCredential = Depends(read_session_cookie)) -> AdminEmailService:
    tokens = OpaqueSessionTokens()
    if not credential.present or tokens.digest(credential.token) is None:
        raise invalid_admin_proof()
    failed = False
    try:
        codes = get_email_code_service(request)
    except (EmailDeliveryError, EmailCodeUnavailable):
        failed = True
    if failed:
        raise ServiceUnavailableException("Administrator email proof is temporarily unavailable")
    policy = get_admin_email_policy(request)
    return AdminEmailService(PostgresAdminProofRepository(request.app.state.database,policy),codes,tokens,
        policy,session_policy(request.app.state.settings))
