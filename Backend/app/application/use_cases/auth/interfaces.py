"""
Service interfaces for dependency inversion in Auth use cases.
"""

from app.domain.entities.refresh_token_entity import RefreshTokenEntity


class IPasswordService:
    """Interface for password operations."""

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        raise NotImplementedError

    def hash(self, password: str) -> str:
        """Hash a plain text password."""
        raise NotImplementedError


class ITokenService:
    """Interface for token operations."""

    @property
    def access_token_expire_minutes(self) -> int:
        """Get access token expiration in minutes."""
        raise NotImplementedError

    def generate_access_token(self, data: dict) -> str:
        """Generate an access token."""
        raise NotImplementedError

    def generate_refresh_token(self, user_id: str) -> "RefreshTokenEntity":
        """Generate a refresh token entity."""
        raise NotImplementedError
