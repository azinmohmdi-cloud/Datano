"""
True Clean Architecture Use Case for User Logout.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from .models import LogoutRequest, LogoutResponse
from .session_service import SessionService


class LogoutUseCase:
    """Idempotently revoke only the browser's current opaque session."""

    def __init__(
        self,
        sessions: SessionService,
    ) -> None:
        self._sessions = sessions

    async def execute(self, request: LogoutRequest) -> LogoutResponse:
        # Do not require a live/active identity: expired, revoked and disabled
        # accounts must still be able to clear their browser credentials. Errors
        # propagate so a failed transaction cannot be reported as successful logout.
        if request.session_token is not None:
            await self._sessions.revoke(request.session_token)
        return LogoutResponse(success=True)
