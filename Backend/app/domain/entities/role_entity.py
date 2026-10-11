"""
Domain Entity for Role - contains business logic and behavior
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import List, Optional
from uuid import uuid4

from app.domain.error.exceptions import ValidationException


@dataclass
class RoleEntity:
    """Domain entity for Role with business logic."""

    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    is_active: bool = True
    permission_ids: List[str] = field(
        default_factory=list
    )  # List of permission IDs for M:N relationship

    @classmethod
    def create(
        cls,
        name: str,
        resource_id: Optional[str] = None,
        permission_ids: Optional[List[str]] = None,
    ) -> "RoleEntity":
        """Create a new RoleEntity entity with validation."""
        # Validate inputs
        cls._validate_name(name)

        resource_id = resource_id or str(uuid4())
        now = datetime.now(UTC)

        return cls(
            id=resource_id,
            name=name,
            created_at=now,
            updated_at=now,
            is_active=True,
            permission_ids=permission_ids or [],
        )

    def update_info(
        self,
        name: Optional[str] = None,
        is_active: Optional[bool] = None,
        permission_ids: Optional[List[str]] = None,
    ) -> None:
        """Update Role information with validation."""
        if name is not None:
            self._validate_name(name)
            self.name = name

        if is_active is not None:
            self.is_active = is_active

        if permission_ids is not None:
            self.permission_ids = permission_ids

        self.updated_at = datetime.now(UTC)

    def deactivate(self) -> None:
        """Deactivate the Role."""
        self.is_active = False
        self.updated_at = datetime.now(UTC)

    def activate(self) -> None:
        """Activate the Role."""
        self.is_active = True
        self.updated_at = datetime.now(UTC)

    @staticmethod
    def _validate_name(name: str) -> None:
        """Validate name format."""
        if not name or len(name.strip()) == 0:
            raise ValidationException("Name cannot be empty", field="name")
        if len(name) > 100:
            raise ValidationException("Name is too long", field="name")

    # Conversion methods are now handled by the RoleMapper class
    # See app.models.role.mapper.RoleMapper
