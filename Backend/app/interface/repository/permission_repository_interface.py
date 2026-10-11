"""
Interface for permission repository operations.
This follows the dependency inversion principle by having the service layer
depend on this abstraction rather than concrete implementations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional

from app.domain.entities import PermissionEntity


class IPermissionRepository(ABC):
    """Interface for permission repository operations."""

    @abstractmethod
    async def get_by_id(self, permission_id: str) -> Optional[PermissionEntity]:
        """Get a permission by ID from the repository."""
        pass

    @abstractmethod
    async def get_by_title(self, title: str) -> Optional[PermissionEntity]:
        """Get a permission by title from the repository."""
        pass

    @abstractmethod
    async def get_all(self) -> List[PermissionEntity]:
        """Get all permissions from the repository."""
        pass

    @abstractmethod
    async def search_by_title(self, title_query: str) -> List[PermissionEntity]:
        """Search permissions by title from the repository."""
        pass
