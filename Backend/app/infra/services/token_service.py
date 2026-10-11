"""
Token service implementation - Infrastructure layer.
Implements ITokenService from the application layer.
"""

from app.application.use_cases.auth.interfaces import ITokenService
from app.domain.entities import RefreshTokenEntity
from app.infra.core.config import config
from app.infra.utils.auth.jwt import generate_access_token
from app.infra.utils.auth.refresh_token import generate_refresh_token


class JoseTokenService(ITokenService):
    """JWT token service using python-jose library."""

    @property
    def access_token_expire_minutes(self) -> int:
        """Get access token expiration in minutes."""
        return config.access_token_expire_minutes

    def generate_access_token(self, data: dict) -> str:
        """Generate an access token."""
        return generate_access_token(data)

    def generate_refresh_token(self, user_id: str) -> RefreshTokenEntity:
        """Generate a refresh token entity."""
        return generate_refresh_token(user_id)
