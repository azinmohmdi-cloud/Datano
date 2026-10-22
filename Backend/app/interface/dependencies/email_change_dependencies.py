from fastapi import Depends, Request

from app.application.use_cases.auth.email import EmailDeliveryError
from app.application.use_cases.auth.email_change import EmailChangeService, invalid_email_change
from app.application.use_cases.auth.email_codes import EmailCodeUnavailable
from app.domain.error.exceptions import ServiceUnavailableException
from app.infra.repositories.postgres.email_change_repository import PostgresEmailChangeRepository
from app.infra.services.session_token_service import OpaqueSessionTokens
from app.interface.dependencies.admin_dependencies import get_admin_email_policy
from app.interface.dependencies.email_code_dependencies import get_email_code_service
from app.interface.dependencies.session_dependencies import session_policy
from app.interface.session_cookie import SessionCredential, read_session_cookie


def get_email_change_service(request: Request, credential: SessionCredential = Depends(read_session_cookie)) -> EmailChangeService:
    tokens = OpaqueSessionTokens()
    if not credential.present or tokens.digest(credential.token) is None:
        raise invalid_email_change()
    failed = False
    try:
        codes = get_email_code_service(request)
    except (EmailDeliveryError, EmailCodeUnavailable):
        failed = True
    if failed:
        raise ServiceUnavailableException("Email change is temporarily unavailable")
    return EmailChangeService(PostgresEmailChangeRepository(request.app.state.database, get_admin_email_policy(request)),
        codes, tokens, session_policy(request.app.state.settings))
