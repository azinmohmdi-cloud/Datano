from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy.exc import DataError, IntegrityError

from app.domain.entities import RoleEntity, UserEntity
from app.domain.error.exceptions import (
    ConflictException,
    ResourceNotFoundException,
    ValidationException,
)
from app.infra.database.models import RoleRow, UserRow


def role_entity(row: RoleRow) -> RoleEntity:
    return RoleEntity(
        id=row.id,
        name=row.name,
        permission_ids=list(row.permission_ids),
        created_at=row.created_at,
        updated_at=row.updated_at,
        is_active=row.is_active,
    )


def user_entity(row: UserRow, roles: list[RoleEntity] | None = None) -> UserEntity:
    return UserEntity(
        id=row.id,
        first_name=row.first_name,
        last_name=row.last_name,
        email=row.email,
        username=row.username,
        hashed_password=row.hashed_password,
        created_at=row.created_at,
        updated_at=row.updated_at,
        is_active=row.is_active,
        roles=roles if roles is not None else [],
    )


@contextmanager
def translate_constraints() -> Iterator[None]:
    """Known DB violations use existing domain errors; the outer UoW rolls back."""
    try:
        yield
    except (IntegrityError, DataError) as error:
        code = getattr(error.orig, "sqlstate", None)
        if code == "23505":
            raise ConflictException(
                "Record already exists or role is already assigned"
            ) from None
        if code == "23503":
            raise ResourceNotFoundException("User or Role", "referenced record") from None
        if code in {"23502", "23514", "22001"}:
            raise ValidationException(
                "User or role violates a persistence constraint"
            ) from None
        raise
