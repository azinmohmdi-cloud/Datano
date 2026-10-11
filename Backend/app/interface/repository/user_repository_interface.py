"""
Interface for user repository operations.
This follows the dependency inversion principle by having the service layer
depend on this abstraction rather than concrete implementations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional

from fastapi_pagination import Page, Params

from app.domain.entities import UserEntity


class IUserRepository(ABC):
    """Interface for user repository operations."""

    @abstractmethod
    async def get_by_id(self, user_id: str) -> Optional[UserEntity]:
        """Get a user by ID from the repository."""
        pass

    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[UserEntity]:
        """Get a user by email from the repository."""
        pass

    @abstractmethod
    async def get_by_username(self, username: str) -> Optional[UserEntity]:
        """Get a user by username from the repository."""
        pass

    @abstractmethod
    async def get_all(self, params: Params) -> Page[UserEntity]:
        """Get all users from the repository."""
        pass

    @abstractmethod
    async def create(self, user_to_create: UserEntity) -> UserEntity:
        """Create a new user in the repository."""
        pass

    @abstractmethod
    async def update(self, source: UserEntity) -> Optional[UserEntity]:
        """Update a user in the repository."""
        pass

    @abstractmethod
    async def delete(self, user_id: str) -> Optional[UserEntity]:
        """Delete a user from the repository."""
        pass

    @abstractmethod
    async def assign_role(self, user_id: str, role_id: str) -> UserEntity:
        """Assign a role to a user."""
        pass

    @abstractmethod
    async def remove_role(self, user_id: str, role_id: str) -> UserEntity:
        """Remove a role from a user."""
        pass
