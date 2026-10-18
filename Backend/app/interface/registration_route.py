"""Registration-only guards run before FastAPI parses a credential body."""
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.routing import APIRoute
from starlette.types import Message

from app.domain.error.exceptions import RateLimitExceededException, RequestTooLargeException, ValidationException
from app.interface.dependencies.registration_dependencies import get_registration_limiter
from app.application.use_cases.auth.interfaces import IRegistrationLimiter


class RegistrationRoute(APIRoute):
    def limiter(self, request: Request) -> IRegistrationLimiter:
        return get_registration_limiter(request)

    def maximum_body(self, request: Request) -> int:
        return request.app.state.settings.registration_max_body_bytes

    def rate_limit_error(self, retry_after: int) -> RateLimitExceededException:
        return RateLimitExceededException(retry_after)

    def oversized_error(self) -> RequestTooLargeException:
        return RequestTooLargeException()

    def get_route_handler(self) -> Callable[[Request], Awaitable[Response]]:
        original = super().get_route_handler()

        async def guarded(request: Request) -> Response:
            peer = request.client.host if request.client is not None else None
            decision = await self.limiter(request).consume(peer)
            if not decision.allowed:
                raise self.rate_limit_error(decision.retry_after)
            maximum = self.maximum_body(request)
            length = request.headers.get("content-length")
            if length is not None:
                try:
                    declared = int(length)
                except ValueError:
                    raise ValidationException("Invalid Content-Length", field="body") from None
                if declared < 0:
                    raise ValidationException("Invalid Content-Length", field="body")
                if declared > maximum:
                    raise self.oversized_error()
            body = bytearray()
            async for chunk in request.stream():
                if len(body) + len(chunk) > maximum:
                    raise self.oversized_error()
                body.extend(chunk)

            async def receive() -> Message:
                return {"type":"http.request", "body":bytes(body), "more_body":False}

            return await original(Request(request.scope, receive=receive))

        return guarded
