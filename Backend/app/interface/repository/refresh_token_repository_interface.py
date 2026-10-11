"""
Interface for refresh token repository operations.
This follows the dependency inversion principle by having the service layer
depend on this abstraction rather than concrete implementations.
"""

from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities import RefreshTokenEntity


class IRefreshTokenRepository(ABC):
    """Interface for refresh token repository operations."""

    @abstractmethod
    async def create_refresh_token(
        self, refresh_token_to_create: RefreshTokenEntity
    ) -> RefreshTokenEntity:
        """Create a new refresh token in the repository."""
        pass

    @abstractmethod
    async def get_refresh_token_by_token(
        self, token: str
    ) -> Optional[RefreshTokenEntity]:
        """Get a refresh token by its token value from the repository."""
        pass

    @abstractmethod
    async def revoke_refresh_token(self, token_id: str) -> bool:
        """Revoke a refresh token in the repository."""
        pass
