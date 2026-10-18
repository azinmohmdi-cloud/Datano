"""
True Clean Architecture Use Case for User Login.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from .authenticate_use_case import AuthenticateUserUseCase
from .models import LoginRequest, LoginResponse
from .session_service import SessionService
from .current_identity_use_case import GetCurrentIdentityUseCase
from app.domain.error.exceptions import CredentialsValidationException, ResourceNotFoundException


class LoginUseCase:
    """Use case for user login."""

    def __init__(
        self,
        authenticate_use_case: AuthenticateUserUseCase,
        session_service: SessionService,
        current_identity: GetCurrentIdentityUseCase,
    ) -> None:
        self._authenticate_use_case = authenticate_use_case
        self._sessions = session_service
        self._identity = current_identity

    async def execute(self, request: LoginRequest) -> LoginResponse:
        """Execute the use case to login a user."""
        user = await self._authenticate_use_case.execute(
            request.username, request.password, email=request.email, upgrade_hash=False
        )

        try:
            issued = await self._sessions.issue(user.id, remember_me=request.remember_me,
                previous_token=request.previous_session_token)
        except ResourceNotFoundException:
            raise CredentialsValidationException() from None
        # The first verification is read-only: legacy hash CAS must not lock the
        # target account before rotation orders both account locks. Reverify and
        # upgrade under those locks so concurrent password/account changes win.
        identity = await self._identity.execute(user.id)
        verified = await self._authenticate_use_case.execute(identity.user.username, request.password)
        if verified.id != user.id:
            raise CredentialsValidationException()
        return LoginResponse(identity=identity, session=issued)
