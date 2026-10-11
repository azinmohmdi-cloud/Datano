"""
Domain Entity for User - contains business logic and behavior
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, List, Optional
from uuid import uuid4

from app.domain.error.exceptions import ValidationException

if TYPE_CHECKING:
    from app.domain.entities import RoleEntity


@dataclass
class UserEntity:
    """Domain entity for User with business logic."""

    id: str
    first_name: str
    last_name: str
    email: str
    username: str
    hashed_password: str
    created_at: datetime
    updated_at: datetime
    is_active: bool
    roles: Optional[List["RoleEntity"]] = None

    @classmethod
    def create(
        cls,
        first_name: str,
        last_name: str,
        email: str,
        username: str,
        hashed_password: str,
        user_id: Optional[str] = None,
        roles: Optional[List["RoleEntity"]] = None,
    ) -> "UserEntity":
        """Create a new UserEntity entity with validation."""
        # Validate inputs
        cls._validate_email(email)
        cls._validate_username(username)

        user_id = user_id or str(uuid4())
        now = datetime.now(UTC)
        roles = roles or []

        return cls(
            id=user_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            username=username,
            hashed_password=hashed_password,
            created_at=now,
            updated_at=now,
            is_active=False,
            roles=roles,
        )

    def update_info(
        self,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        email: Optional[str] = None,
        username: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> None:
        """Update user information with validation."""

        if first_name is not None:
            self.first_name = first_name
        if last_name is not None:
            self.last_name = last_name
        if is_active is not None:
            self.is_active = is_active
        if email is not None:
            self._validate_email(email)
            self.email = email
        if username is not None:
            self._validate_username(username)
            self.username = username

        self.updated_at = datetime.now(UTC)

    def deactivate(self) -> None:
        """Deactivate the user account."""
        self.is_active = False
        self.updated_at = datetime.now(UTC)

    def activate(self) -> None:
        """Activate the user account."""
        self.is_active = True
        self.updated_at = datetime.now(UTC)

    def change_password(self, new_hashed_password: str) -> None:
        """Change the user's password after validation."""
        self.hashed_password = new_hashed_password
        self.updated_at = datetime.now(UTC)

    @staticmethod
    def _validate_email(email: str) -> None:
        """Validate email format."""
        if not email or "@" not in email or "." not in email:
            raise ValidationException(f"Invalid email format: {email}", field="email")

    @staticmethod
    def _validate_username(username: str) -> None:
        """Validate username format."""
        if not username or len(username) < 3 or len(username) > 50:
            raise ValidationException(
                f"Username must be between 3 and 50 characters: {username}",
                field="username",
            )

    @staticmethod
    def _validate_password(password: str) -> None:
        """Validate password strength."""
        if not password or len(password) < 8:
            raise ValidationException(
                "Password must be at least 8 characters long", field="password"
            )

    # Conversion methods are now handled by the UserMapper class
    # See app.models.user.mapper.UserMapper
