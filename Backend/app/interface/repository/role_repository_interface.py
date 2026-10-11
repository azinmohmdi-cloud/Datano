"""
Interface for role repository operations.
This follows the dependency inversion principle by having the service layer
depend on this abstraction rather than concrete implementations.
"""

from abc import ABC, abstractmethod
from typing import Optional

from fastapi_pagination import Page, Params

from app.domain.entities import RoleEntity


class IRoleRepository(ABC):
    """Interface for role repository operations."""

    @abstractmethod
    async def get_all(self, params: Params) -> Page[RoleEntity]:
        """Get all roles from the repository."""
        pass

    @abstractmethod
    async def get_by_id(self, role_id: str) -> Optional[RoleEntity]:
        """Get a role by ID from the repository."""
        pass

    @abstractmethod
    async def get_by_name(self, name: str) -> Optional[RoleEntity]:
        """Get a role by name from the repository."""
        pass

    @abstractmethod
    async def create(self, created_domain: RoleEntity) -> RoleEntity:
        """Create a new role in the repository."""
        pass

    @abstractmethod
    async def update(self, updated_domain: RoleEntity) -> Optional[RoleEntity]:
        """Update a role in the repository."""
        pass

    @abstractmethod
    async def delete(self, role_id: str) -> Optional[RoleEntity]:
        """Delete a role from the repository."""
        pass
