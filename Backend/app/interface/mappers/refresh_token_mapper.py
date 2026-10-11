"""
Mapper for converting between RefreshToken domain and DTO models.
The Entity is the core of conversions
"""

from app.domain.entities import RefreshTokenEntity
from app.interface.dto import RefreshToken, RefreshTokenCreate


class RefreshTokenMapper:
    """Mapper for converting between RefreshToken domain, DTO, and entity models."""

    @staticmethod
    def to_dto(refresh_token_entity: RefreshTokenEntity) -> RefreshToken:
        """Convert RefreshToken domain model to DTO."""
        return RefreshToken(
            id=refresh_token_entity.id,
            token=refresh_token_entity.token,
            user_id=refresh_token_entity.user_id,
            expires_at=refresh_token_entity.expires_at,
            created_at=refresh_token_entity.created_at,
            revoked=refresh_token_entity.revoked,
            blacklisted=refresh_token_entity.blacklisted,
        )

    @staticmethod
    def to_create_dto(
        refresh_token_entity: RefreshTokenEntity,
    ) -> RefreshTokenCreate:
        """Convert RefreshToken domain model to DTO."""
        return RefreshTokenCreate(
            user_id=refresh_token_entity.user_id,
            expires_at=refresh_token_entity.expires_at,
        )
