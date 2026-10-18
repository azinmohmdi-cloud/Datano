"""Registration-only guards run before FastAPI parses a credential body."""
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.routing import APIRoute
from starlette.types import Message

from app.domain.error.exceptions import RateLimitExceededException, RequestTooLargeException, ValidationException
from app.interface.dependencies.registration_dependencies import get_registration_limiter


class RegistrationRoute(APIRoute):
    def get_route_handler(self) -> Callable[[Request], Awaitable[Response]]:
        original = super().get_route_handler()

        async def guarded(request: Request) -> Response:
            peer = request.client.host if request.client is not None else None
            decision = await get_registration_limiter(request).consume(peer)
            if not decision.allowed:
                raise RateLimitExceededException(decision.retry_after)
            maximum = request.app.state.settings.registration_max_body_bytes
            length = request.headers.get("content-length")
            if length is not None:
                try:
                    declared = int(length)
                except ValueError:
                    raise ValidationException("Invalid Content-Length", field="body") from None
                if declared < 0:
                    raise ValidationException("Invalid Content-Length", field="body")
                if declared > maximum:
                    raise RequestTooLargeException()
            body = bytearray()
            async for chunk in request.stream():
                if len(body) + len(chunk) > maximum:
                    raise RequestTooLargeException()
                body.extend(chunk)

            async def receive() -> Message:
                return {"type":"http.request", "body":bytes(body), "more_body":False}

            return await original(Request(request.scope, receive=receive))

        return guarded
