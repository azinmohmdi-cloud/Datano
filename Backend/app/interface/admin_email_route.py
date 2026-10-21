from fastapi import Request

from app.application.use_cases.auth.interfaces import IRegistrationLimiter
from app.domain.error.exceptions import RateLimitExceededException, RequestTooLargeException, ServiceUnavailableException
from app.infra.services.registration_limiter import PostgresRegistrationLimiter
from app.interface.registration_route import RegistrationRoute


def get_admin_email_limiter(request: Request) -> IRegistrationLimiter:
    database = getattr(request.app.state,"database",None)
    if database is None:
        raise ServiceUnavailableException("Administrator email proof is temporarily unavailable")
    settings = request.app.state.settings
    return PostgresRegistrationLimiter(database,namespace="admin-email",limit=settings.admin_proof_ip_limit,
        window_seconds=settings.admin_proof_window_seconds)


class AdminEmailRoute(RegistrationRoute):
    def limiter(self, request: Request) -> IRegistrationLimiter:
        factory = request.app.dependency_overrides.get(get_admin_email_limiter,get_admin_email_limiter)
        return factory(request)

    def maximum_body(self, request: Request) -> int:
        return request.app.state.settings.admin_proof_max_body_bytes

    def rate_limit_error(self, retry_after: int) -> RateLimitExceededException:
        return RateLimitExceededException(retry_after,message="Too many administrator proof attempts; try again later")

    def oversized_error(self) -> RequestTooLargeException:
        return RequestTooLargeException("Administrator proof request body is too large")
