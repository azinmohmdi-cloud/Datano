"""
True Clean Architecture Use Case for Refreshing Access Token.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from datetime import UTC, datetime, timedelta

from app.domain.error.exceptions import CredentialsValidationException, InactiveUserException
from app.interface.repository.refresh_token_repository_interface import (
    IRefreshTokenRepository,
)
from app.interface.repository.user_repository_interface import IUserRepository

from .interfaces import ITokenService
from .models import RefreshTokenRequest, RefreshTokenResponse, TokenResponse


class RefreshAccessTokenUseCase:
    """Use case for refreshing an access token."""

    def __init__(
        self,
        refresh_token_repository: IRefreshTokenRepository,
        user_repository: IUserRepository,
        token_service: ITokenService,
    ):
        self._refresh_token_repo = refresh_token_repository
        self._user_repo = user_repository
        self._token_service = token_service

    async def execute(self, request: RefreshTokenRequest) -> RefreshTokenResponse:
        """Execute the use case to refresh an access token."""
        refresh_token_entity = await self._refresh_token_repo.get_refresh_token_by_token(
            request.refresh_token
        )

        if not refresh_token_entity or not refresh_token_entity.is_valid():
            raise CredentialsValidationException("Invalid refresh token")

        user = await self._user_repo.get_by_id(refresh_token_entity.user_id)
        if not user:
            raise CredentialsValidationException("Invalid refresh token")
        elif not user.is_active:
            await self._refresh_token_repo.revoke_refresh_token(
                refresh_token_entity.id
            )
            raise InactiveUserException()

        access_token_str = self._token_service.generate_access_token(
            data={"sub": user.id, "username": user.username},
        )
        access_expires_at = datetime.now(UTC) + timedelta(
            minutes=self._token_service.access_token_expire_minutes
        )
        access_token = TokenResponse(
            title="access_token",
            token=access_token_str,
            type="bearer",
            expires_at=access_expires_at,
        )

        return RefreshTokenResponse(access_token=access_token)
