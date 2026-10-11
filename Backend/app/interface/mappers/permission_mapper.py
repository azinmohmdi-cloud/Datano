"""
Permission Mapper - handles conversion between PermissionEntity and Permission DTO
The Entity is the core of conversions
The Entity gets converted from DTO
And DTO gets converted from Entity
No Direct conversions from Entity to DTO or DTO to Entity (no entities needed for JSON repository)
"""

from app.domain.entities import PermissionEntity
from app.interface.dto import Permission as PermissionDTO


class PermissionMapper:
    """Mapper class to handle conversions between Permission representations."""

    @staticmethod
    def to_dto(domain_permission: PermissionEntity) -> PermissionDTO:
        """Convert domain Permission to DTO."""
        return PermissionDTO(
            id=domain_permission.id,
            title=domain_permission.title,
            description=domain_permission.description,
            created_at=domain_permission.created_at,
            updated_at=domain_permission.updated_at,
        )
