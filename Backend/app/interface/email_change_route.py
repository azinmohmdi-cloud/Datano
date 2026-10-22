from fastapi import Request

from app.application.use_cases.auth.interfaces import IRegistrationLimiter
from app.domain.error.exceptions import RateLimitExceededException, RequestTooLargeException, ServiceUnavailableException
from app.infra.services.registration_limiter import PostgresRegistrationLimiter
from app.interface.registration_route import RegistrationRoute


def get_email_change_limiter(request: Request) -> IRegistrationLimiter:
    database = getattr(request.app.state, "database", None)
    if database is None:
        raise ServiceUnavailableException("Email change is temporarily unavailable")
    settings = request.app.state.settings
    return PostgresRegistrationLimiter(database, namespace="email-change", limit=settings.email_change_ip_limit,
        window_seconds=settings.email_change_window_seconds)


class EmailChangeRoute(RegistrationRoute):
    def limiter(self, request: Request) -> IRegistrationLimiter:
        factory = request.app.dependency_overrides.get(get_email_change_limiter, get_email_change_limiter)
        return factory(request)

    def maximum_body(self, request: Request) -> int:
        return request.app.state.settings.email_change_max_body_bytes

    def rate_limit_error(self, retry_after: int) -> RateLimitExceededException:
        return RateLimitExceededException(retry_after, message="Too many email change attempts; try again later")

    def oversized_error(self) -> RequestTooLargeException:
        return RequestTooLargeException("Email change request body is too large")
