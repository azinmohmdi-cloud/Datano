"""
Refresh token utilities for authentication.
"""

from datetime import UTC, datetime, timedelta

from app.domain.entities import RefreshTokenEntity
from app.infra.core.config import config


def generate_refresh_token(user_id: str) -> RefreshTokenEntity:
    """
    Generate a new refresh token for the user.

    Args:
        user_id: The ID of the user for whom to generate the token

    Returns:
        RefreshTokenEntity object with the generated token
    """
    expires_at = datetime.now(UTC) + timedelta(days=config.refresh_token_expire_days)

    return RefreshTokenEntity.create(user_id=user_id, expires_at=expires_at)
