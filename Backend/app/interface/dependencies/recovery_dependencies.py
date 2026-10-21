from fastapi import Request

from app.application.use_cases.auth.password_recovery import PasswordRecoveryService, ResetPasswordService
from app.application.use_cases.auth.email import EmailDeliveryError
from app.application.use_cases.auth.email_codes import EmailCodeUnavailable
from app.domain.error.exceptions import ServiceUnavailableException
from app.infra.repositories.postgres.recovery_repository import PostgresRecoveryRepository
from app.infra.services.password_service import Argon2PasswordService
from app.infra.services.recovery_token_service import RecoveryTokens
from app.interface.dependencies.email_code_dependencies import get_email_code_service


def get_password_recovery_flow(request: Request) -> PasswordRecoveryService:
    failed = False
    try:
        codes = get_email_code_service(request)
    except (EmailDeliveryError, EmailCodeUnavailable):
        failed = True
    if failed:
        raise ServiceUnavailableException("Password recovery is temporarily unavailable")
    return PasswordRecoveryService(PostgresRecoveryRepository(request.app.state.database), codes,
        RecoveryTokens(), grant_seconds=request.app.state.settings.recovery_grant_seconds)


def get_reset_password_service(request: Request) -> ResetPasswordService:
    # A previously issued grant can reset even during a mail outage/disablement.
    return ResetPasswordService(PostgresRecoveryRepository(request.app.state.database), RecoveryTokens(), Argon2PasswordService())
