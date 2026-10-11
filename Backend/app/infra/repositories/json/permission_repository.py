"""
Implementation of the permission repository using JSON files.
This reads permissions from the JSON file instead of a database.
"""

import json
from typing import List, Optional

from app.domain.entities import PermissionEntity
from app.infra.core.config import config
from app.interface.repository.permission_repository_interface import (
    IPermissionRepository,
)


class JSONPermissionRepository(IPermissionRepository):
    """Implementation of permission repository operations using JSON file."""

    def __init__(self):
        self.permissions_path = config.permissions_path

    async def get_by_id(self, permission_id: str) -> Optional[PermissionEntity]:
        """Get a permission by ID from the JSON file."""
        permissions = await self._load_permissions()
        for perm_data in permissions:
            if perm_data["id"] == permission_id:
                return self._create_permission_domain(perm_data)
        return None

    async def get_by_title(self, title: str) -> Optional[PermissionEntity]:
        """Get a permission by title from the JSON file."""
        permissions = await self._load_permissions()
        for perm_data in permissions:
            if perm_data["title"] == title:
                return self._create_permission_domain(perm_data)
        return None

    async def get_all(self) -> List[PermissionEntity]:
        """Get all permissions from the JSON file."""
        permissions = await self._load_permissions()
        return [self._create_permission_domain(perm_data) for perm_data in permissions]

    async def search_by_title(self, title_query: str) -> List[PermissionEntity]:
        """Search permissions by title from the JSON file."""
        permissions = await self._load_permissions()
        matching_perms = [
            perm_data
            for perm_data in permissions
            if title_query.lower() in perm_data["title"].lower()
        ]
        return [
            self._create_permission_domain(perm_data) for perm_data in matching_perms
        ]

    async def _load_permissions(self) -> List[dict]:
        """Load permissions from the JSON file."""
        try:
            with open(self.permissions_path, "r") as f:
                return json.load(f)
        except FileNotFoundError:
            return []
        except json.JSONDecodeError:
            return []

    def _create_permission_domain(self, perm_data: dict) -> PermissionEntity:
        """Create a PermissionEntity from JSON data."""
        from datetime import datetime

        # Parse datetime strings (handle 'Z' suffix for UTC)
        created_at = datetime.fromisoformat(
            perm_data["created_at"].replace("Z", "+00:00")
        )
        updated_at = datetime.fromisoformat(
            perm_data["updated_at"].replace("Z", "+00:00")
        )

        return PermissionEntity(
            id=perm_data["id"],
            title=perm_data["title"],
            description=perm_data["description"],
            created_at=created_at,
            updated_at=updated_at,
        )
