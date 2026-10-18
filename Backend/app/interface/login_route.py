from collections.abc import Awaitable, Callable
from fastapi import Request, Response
from fastapi.routing import APIRoute

from app.application.use_cases.auth.interfaces import IRegistrationLimiter
from app.domain.error.exceptions import RateLimitExceededException, RequestTooLargeException, ServiceUnavailableException
from app.infra.services.registration_limiter import PostgresRegistrationLimiter
from app.interface.registration_route import RegistrationRoute


def get_login_limiter(request: Request) -> IRegistrationLimiter:
    database = getattr(request.app.state, "database", None)
    if database is None:
        raise ServiceUnavailableException("Login is temporarily unavailable")
    settings = request.app.state.settings
    return PostgresRegistrationLimiter(database, namespace="login", limit=settings.login_ip_limit,
        window_seconds=settings.login_window_seconds)


class LoginRoute(RegistrationRoute):
    """Reuse the bounded credential guard only on login, preserving other routes."""
    def get_route_handler(self) -> Callable[[Request], Awaitable[Response]]:
        if self.path.endswith("/auth/login"):
            return super().get_route_handler()
        return APIRoute.get_route_handler(self)

    def limiter(self, request: Request) -> IRegistrationLimiter:
        factory = request.app.dependency_overrides.get(get_login_limiter, get_login_limiter)
        return factory(request)

    def maximum_body(self, request: Request) -> int:
        return request.app.state.settings.login_max_body_bytes

    def rate_limit_error(self, retry_after: int) -> RateLimitExceededException:
        return RateLimitExceededException(retry_after, message="Too many login attempts; try again later")

    def oversized_error(self) -> RequestTooLargeException:
        return RequestTooLargeException("Login request body is too large")
