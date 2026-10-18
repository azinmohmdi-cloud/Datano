from dataclasses import asdict

from fastapi_pagination import Page, Params
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities import RoleEntity
from app.infra.database.models import RoleRow
from app.infra.repositories.postgres.mapping import role_entity, translate_constraints
from app.interface.repository.role_repository_interface import IRoleRepository


class SQLRoleRepository(IRoleRepository):
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, role_id: str) -> RoleEntity | None:
        row = await self.session.scalar(
            select(RoleRow)
            .where(RoleRow.id == role_id)
            .execution_options(populate_existing=True)
        )
        return role_entity(row) if row is not None else None

    async def get_by_name(self, name: str) -> RoleEntity | None:
        row = await self.session.scalar(
            select(RoleRow)
            .where(RoleRow.name == name)
            .execution_options(populate_existing=True)
        )
        return role_entity(row) if row is not None else None

    async def get_all(self, params: Params) -> Page[RoleEntity]:
        total = await self.session.scalar(select(func.count()).select_from(RoleRow)) or 0
        rows = await self.session.scalars(
            select(RoleRow)
            .order_by(RoleRow.created_at, RoleRow.id)
            .offset((params.page - 1) * params.size)
            .limit(params.size)
            .execution_options(populate_existing=True)
        )
        return Page(
            items=[role_entity(row) for row in rows],
            total=total,
            page=params.page,
            size=params.size,
            pages=max(1, (total + params.size - 1) // params.size),
        )

    async def create(self, created_domain: RoleEntity) -> RoleEntity:
        row = RoleRow(**asdict(created_domain))
        with translate_constraints():
            self.session.add(row)
            await self.session.flush()
        return role_entity(row)

    async def update(self, updated_domain: RoleEntity) -> RoleEntity | None:
        values = asdict(updated_domain)
        values.pop("id")
        values.pop("created_at")
        with translate_constraints():
            row = await self.session.scalar(
                update(RoleRow)
                .where(RoleRow.id == updated_domain.id)
                .values(**values)
                .returning(RoleRow)
                .execution_options(populate_existing=True)
            )
        return role_entity(row) if row is not None else None

    async def delete(self, role_id: str) -> RoleEntity | None:
        row = await self.session.scalar(
            delete(RoleRow).where(RoleRow.id == role_id).returning(RoleRow)
        )
        return role_entity(row) if row is not None else None
