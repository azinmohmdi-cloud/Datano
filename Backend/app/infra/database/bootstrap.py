"""Create required role records without provisioning users or passwords."""
from dataclasses import asdict

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities import RoleEntity
from app.infra.database.models import RoleRow
from app.infra.utils.auth.permission import Permission


async def ensure_required_roles(session: AsyncSession) -> None:
    for name, permissions in (("User", []), ("Admin", [Permission.Super_User.value])):
        role = RoleEntity.create(name, permission_ids=permissions)
        await session.execute(
            insert(RoleRow)
            .values(**asdict(role))
            .on_conflict_do_nothing(index_elements=[RoleRow.name])
        )
