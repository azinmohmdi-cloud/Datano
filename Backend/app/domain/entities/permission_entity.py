"""
Domain Entity for Permission - contains business logic and behavior
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Optional
from uuid import uuid4


@dataclass
class PermissionEntity:
    """Domain entity for Permission with business logic."""

    id: str
    title: str
    description: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def create(
        cls,
        title: str,
        description: str,
        permission_id: Optional[str] = None,
    ) -> "PermissionEntity":
        """Create a new PermissionEntity entity."""
        permission_id = permission_id or str(uuid4())
        now = datetime.now(UTC)

        return cls(
            id=permission_id,
            title=title,
            description=description,
            created_at=now,
            updated_at=now,
        )
