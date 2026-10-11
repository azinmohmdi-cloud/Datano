"""
Role Mapper - handles conversion between RoleEntity and Role DTO
The Entity is the core of conversions
"""

from datetime import UTC, datetime

from app.domain.entities import RoleEntity
from app.interface.dto import Role as RoleDTO
from app.interface.dto import RoleCreate, RoleUpdate


class RoleMapper:
    """Mapper class to handle conversions between Role representations."""

    @staticmethod
    def to_dto(domain_role: RoleEntity) -> RoleDTO:
        """Convert domain Role to DTO."""
        return RoleDTO(
            id=domain_role.id,
            name=domain_role.name,
            created_at=domain_role.created_at,
            updated_at=domain_role.updated_at,
            is_active=domain_role.is_active,
            permission_ids=domain_role.permission_ids or [],
        )

    @staticmethod
    def update_from_dto(role_update: RoleUpdate, role_entity: RoleEntity) -> RoleEntity:
        """Apply RoleUpdate DTO to an existing RoleEntity and return updated domain entity."""
        update_data = {
            k: v for k, v in role_update.model_dump().items() if v is not None
        }

        if "name" in update_data:
            role_entity.name = update_data["name"]

        if "is_active" in update_data:
            role_entity.is_active = update_data["is_active"]

        if "permission_ids" in update_data:
            role_entity.permission_ids = update_data["permission_ids"]

        if update_data:
            role_entity.updated_at = datetime.now(UTC)

        return role_entity
