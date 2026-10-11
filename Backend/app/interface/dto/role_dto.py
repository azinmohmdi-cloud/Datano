from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class RoleBase(BaseModel):
    """Base Role model with common fields."""

    name: str


class RoleCreate(RoleBase):
    """Role model for creating new roles"""

    permission_ids: Optional[List[str]] = None  # Optional field for creation


class RoleUpdate(BaseModel):
    """Role model for updating existing roles"""

    name: Optional[str] = None
    is_active: Optional[bool] = None
    permission_ids: Optional[List[str]] = None  # Optional field for updates


class Role(BaseModel):
    """Public Role model without sensitive data"""

    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    is_active: bool = True
    permission_ids: List[str] = []  # List of permission IDs for the M:N relationship

    # Add other fields as needed but exclude sensitive data
