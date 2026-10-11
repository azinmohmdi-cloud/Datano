"""
Refresh token-related dependencies and dependency injection logic.
"""

from fastapi import Depends

from app.infra.repositories.in_memory.registry import (
    refresh_token_repository as _in_memory_refresh_token_repository,
)
from app.interface.repository.refresh_token_repository_interface import (
    IRefreshTokenRepository,
)


async def get_refresh_token_repository() -> IRefreshTokenRepository:
    """Dependency to get refresh token repository instance."""
    return _in_memory_refresh_token_repository
