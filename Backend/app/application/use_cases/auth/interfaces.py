"""
Service interfaces for dependency inversion in Auth use cases.
"""

from dataclasses import dataclass, field

from app.domain.entities.refresh_token_entity import RefreshTokenEntity


class ISessionTokens:
    def generate(self) -> str:
        raise NotImplementedError

    def digest(self, token: str) -> bytes | None:
        raise NotImplementedError


@dataclass(frozen=True)
class PasswordVerification:
    valid: bool
    replacement_hash: str | None = field(default=None, repr=False)


@dataclass(frozen=True)
class RegistrationLimitDecision:
    allowed: bool
    retry_after: int = 0


class IRegistrationLimiter:
    async def consume(self, peer: str | None) -> RegistrationLimitDecision:
        """Record an attempt independently of the account transaction."""
        raise NotImplementedError


class IPasswordService:
    """Interface for password operations."""

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        raise NotImplementedError

    def hash(self, password: str) -> str:
        """Hash a plain text password."""
        raise NotImplementedError

    def verify_and_rehash(self, plain_password: str, hashed_password: str) -> PasswordVerification:
        """Compatible default for adapters that do not support hash upgrades."""
        return PasswordVerification(self.verify(plain_password, hashed_password))


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
