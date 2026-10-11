"""
User Mapper - handles conversion between UserEntity and User DTO
The Entity is the core of conversions
"""

from app.domain.entities import UserEntity
from app.interface.dto import User as UserDTO
from app.interface.dto import UserCreate, UserUpdate
from app.interface.mappers import RoleMapper


class UserMapper:
    """Mapper class to handle conversions between user representations."""

    @staticmethod
    def to_dto(domain_user: UserEntity) -> UserDTO:
        """Convert domain user to DTO."""
        roles_dto = []
        if domain_user.roles:
            roles_dto = [RoleMapper.to_dto(role) for role in domain_user.roles]

        return UserDTO(
            id=domain_user.id,
            first_name=domain_user.first_name,
            last_name=domain_user.last_name,
            email=domain_user.email,
            username=domain_user.username,
            roles=roles_dto,
            created_at=domain_user.created_at,
            updated_at=domain_user.updated_at,
            is_active=domain_user.is_active,
        )

    @staticmethod
    def update_from_dto(user_update: UserUpdate, user_entity: UserEntity) -> UserEntity:
        """Apply UserUpdate DTO to an existing UserEntity and return updated entity."""
        update_data = {
            k: v for k, v in user_update.model_dump().items() if v is not None
        }

        user_entity.update_info(
            first_name=update_data.get("first_name"),
            last_name=update_data.get("last_name"),
            email=update_data.get("email"),
            username=update_data.get("username"),
            is_active=update_data.get("is_active"),
        )

        return user_entity
