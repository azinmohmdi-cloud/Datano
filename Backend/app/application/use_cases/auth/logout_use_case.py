"""
True Clean Architecture Use Case for User Logout.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from app.interface.repository.refresh_token_repository_interface import (
    IRefreshTokenRepository,
)

from .models import LogoutRequest, LogoutResponse


class LogoutUseCase:
    """Use case for logging out a user."""

    def __init__(
        self,
        refresh_token_repository: IRefreshTokenRepository,
    ):
        self._refresh_token_repo = refresh_token_repository

    async def execute(self, request: LogoutRequest) -> LogoutResponse:
        """Execute the use case to logout a user."""
        refresh_token_entity = await self._refresh_token_repo.get_refresh_token_by_token(
            request.refresh_token
        )

        if not refresh_token_entity:
            return LogoutResponse(success=False)

        success = await self._refresh_token_repo.revoke_refresh_token(
            refresh_token_entity.id
        )
        return LogoutResponse(success=success)
