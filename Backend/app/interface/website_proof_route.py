from fastapi import Request

from app.application.use_cases.auth.interfaces import IRegistrationLimiter
from app.domain.error.exceptions import RateLimitExceededException, RequestTooLargeException, ServiceUnavailableException
from app.infra.services.registration_limiter import PostgresRegistrationLimiter
from app.interface.registration_route import RegistrationRoute


def get_website_proof_limiter(request: Request) -> IRegistrationLimiter:
    database = getattr(request.app.state, "database", None)
    if database is None: raise ServiceUnavailableException("Website ownership is temporarily unavailable")
    settings = request.app.state.settings
    return PostgresRegistrationLimiter(database, namespace="website-proof", limit=settings.website_proof_ip_limit,
        window_seconds=settings.website_proof_window_seconds)


class WebsiteProofRoute(RegistrationRoute):
    def limiter(self, request: Request) -> IRegistrationLimiter:
        return request.app.dependency_overrides.get(get_website_proof_limiter, get_website_proof_limiter)(request)

    def maximum_body(self, request: Request) -> int:
        return request.app.state.settings.website_proof_max_body_bytes

    def rate_limit_error(self, retry_after: int) -> RateLimitExceededException:
        return RateLimitExceededException(retry_after, message="Too many website proof attempts; try again later")

    def oversized_error(self) -> RequestTooLargeException:
        return RequestTooLargeException("Website proof request body is too large")
