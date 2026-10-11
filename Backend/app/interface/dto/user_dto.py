from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class UserBase(BaseModel):
    """Base user model with common fields."""

    first_name: str
    last_name: str
    email: str
    username: str


class UserCreate(UserBase):
    """User model for creating new users"""

    password: str


class UserUpdate(BaseModel):
    """User model for updating existing users"""

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    is_active: Optional[bool] = None


class User(BaseModel):
    """Public user model without sensitive data"""

    id: str
    first_name: str
    last_name: str
    email: str
    username: str
    roles: List["Role"] = []
    created_at: datetime
    updated_at: datetime
    is_active: bool = True

    # hashed_password is deliberately omitted to exclude it from the public model


class UserWithPassword(User):
    """User model that includes the hashed password - used internally only"""

    hashed_password: str


# Add the Role import at the end to handle circular imports
from app.interface.dto import Role  # noqa: E402
