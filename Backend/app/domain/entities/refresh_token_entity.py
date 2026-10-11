import secrets
from datetime import UTC, datetime


class RefreshTokenEntity:
    """Domain entity for refresh tokens with business logic."""

    def __init__(
        self,
        id: str,
        token: str,
        user_id: str,
        expires_at: datetime,
        created_at: datetime,
        revoked: bool = False,
        blacklisted: bool = False,
    ):
        self.id = id
        self._token = token
        self.user_id = user_id
        self.expires_at = expires_at
        self.created_at = created_at
        self.revoked = revoked
        self.blacklisted = blacklisted

    @property
    def token(self) -> str:
        """Get the refresh token (read-only from outside the domain)."""
        return self._token

    @classmethod
    def create(
        cls, user_id: str, expires_at: datetime, id: str | None = None
    ) -> "RefreshTokenEntity":
        """Create a new refresh token domain entity."""
        import uuid

        token_id = id or str(uuid.uuid4())
        token = secrets.token_urlsafe(32)  # Generate a secure random token

        return cls(
            id=token_id,
            token=token,
            user_id=user_id,
            expires_at=expires_at,
            created_at=datetime.now(UTC),
            revoked=False,
            blacklisted=False,
        )

    def is_valid(self) -> bool:
        """Check if the refresh token is valid (not expired, not revoked, not blacklisted)."""
        return (
            not self.revoked
            and not self.blacklisted
            and datetime.now(UTC) < self.expires_at
        )

    def revoke(self) -> None:
        """Revoke the refresh token."""
        self.revoked = True

    def blacklist(self) -> None:
        """Blacklist the refresh token."""
        self.blacklisted = True
