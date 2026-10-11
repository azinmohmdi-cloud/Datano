from datetime import datetime

from pydantic import BaseModel


class PermissionBase(BaseModel):
    """Base Permission model with common fields."""

    title: str
    description: str


class Permission(PermissionBase):
    """Public Permission model without sensitive data"""

    id: str
    created_at: datetime
    updated_at: datetime
