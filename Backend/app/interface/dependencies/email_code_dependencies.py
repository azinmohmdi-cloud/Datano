from fastapi import Request

from app.application.use_cases.auth.email_codes import EmailCodeService, EmailCodeUnavailable
from app.infra.repositories.postgres.email_code_repository import PostgresEmailCodeRepository
from app.infra.services.email_code_crypto import EmailCodeCrypto
from app.interface.dependencies.email_dependencies import get_email_sender


def get_email_code_service(request: Request) -> EmailCodeService:
    key = request.app.state.settings.email_code_hmac_key
    if key is None:
        raise EmailCodeUnavailable()
    invalid = False
    try:
        crypto = EmailCodeCrypto(key.get_secret_value().encode("utf-8"))
    except (ValueError, UnicodeError):
        invalid = True
    if invalid:
        raise EmailCodeUnavailable()
    return EmailCodeService(PostgresEmailCodeRepository(request.app.state.database), crypto, get_email_sender(request))
