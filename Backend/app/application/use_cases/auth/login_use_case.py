"""
True Clean Architecture Use Case for User Login.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from datetime import UTC, datetime, timedelta

from app.interface.repository.refresh_token_repository_interface import (
    IRefreshTokenRepository,
)

from .authenticate_use_case import AuthenticateUserUseCase
from .interfaces import ITokenService
from .models import LoginRequest, LoginResponse, TokenResponse


class LoginUseCase:
    """Use case for user login."""

    def __init__(
        self,
        authenticate_use_case: AuthenticateUserUseCase,
        token_service: ITokenService,
        refresh_token_repository: IRefreshTokenRepository,
    ):
        self._authenticate_use_case = authenticate_use_case
        self._token_service = token_service
        self._refresh_token_repo = refresh_token_repository

    async def execute(self, request: LoginRequest) -> LoginResponse:
        """Execute the use case to login a user."""
        user = await self._authenticate_use_case.execute(
            request.username, request.password
        )

        # Generate access token
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

        # Generate refresh token
        refresh_token_entity = self._token_service.generate_refresh_token(user.id)
        refresh_token_dto = await self._refresh_token_repo.create_refresh_token(
            refresh_token_entity
        )
        refresh_token = TokenResponse(
            title="refresh_token",
            token=refresh_token_dto.token,
            type="cookie",
            expires_at=refresh_token_dto.expires_at,
        )

        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
        )
