from dataclasses import asdict
from datetime import datetime

from fastapi_pagination import Page, Params
from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.domain.entities import RoleEntity, UserEntity
from app.domain.error.exceptions import ResourceNotFoundException
from app.domain.identity import canonical_email
from app.infra.database.models import AdminGrantRow, RoleRow, UserRow, user_roles
from app.infra.repositories.postgres.mapping import role_entity, translate_constraints, user_entity
from app.interface.repository.user_repository_interface import IUserRepository


class SQLUserRepository(IUserRepository):
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _entities(self, rows: list[UserRow]) -> list[UserEntity]:
        if not rows:
            return []
        # Load the roles for the whole result page in one query, without lazy I/O.
        assignments = await self.session.execute(
            select(user_roles.c.user_id, RoleRow)
            .join(RoleRow, RoleRow.id == user_roles.c.role_id)
            .where(user_roles.c.user_id.in_([row.id for row in rows]))
            .order_by(RoleRow.created_at, RoleRow.id)
            .execution_options(populate_existing=True)
        )
        roles: dict[str, list[RoleEntity]] = {}
        for user_id, role in assignments:
            roles.setdefault(user_id, []).append(role_entity(role))
        return [user_entity(row, roles.get(row.id, [])) for row in rows]

    async def _get(self, condition: ColumnElement[bool]) -> UserEntity | None:
        row = await self.session.scalar(
            select(UserRow).where(condition).execution_options(populate_existing=True)
        )
        return (await self._entities([row]))[0] if row is not None else None

    async def get_by_id(self, user_id: str) -> UserEntity | None:
        return await self._get(UserRow.id == user_id)

    async def get_by_email(self, email: str) -> UserEntity | None:
        return await self._get(UserRow.email_key == canonical_email(email))

    async def get_by_username(self, username: str) -> UserEntity | None:
        return await self._get(UserRow.username == username)

    async def replace_password_hash(self, user_id: str, expected: str, replacement: str) -> bool:
        result = await self.session.execute(
            update(UserRow)
            .where(UserRow.id == user_id, UserRow.hashed_password == expected)
            .values(hashed_password=replacement)
        )
        return result.rowcount == 1

    async def get_all(self, params: Params) -> Page[UserEntity]:
        total = await self.session.scalar(select(func.count()).select_from(UserRow)) or 0
        rows = list(await self.session.scalars(
            select(UserRow)
            .order_by(UserRow.created_at, UserRow.id)
            .offset((params.page - 1) * params.size)
            .limit(params.size)
            .execution_options(populate_existing=True)
        ))
        return Page(
            items=await self._entities(rows),
            total=total,
            page=params.page,
            size=params.size,
            pages=max(1, (total + params.size - 1) // params.size),
        )

    async def create(self, user_to_create: UserEntity) -> UserEntity:
        values = asdict(user_to_create)
        values.pop("roles")
        values["email_key"] = canonical_email(user_to_create.email)
        row = UserRow(**values)
        with translate_constraints():
            self.session.add(row)
            await self.session.flush()
        return user_entity(row)

    async def update(self, source: UserEntity) -> UserEntity | None:
        previous = (await self.session.execute(select(UserRow.email_key,UserRow.is_active)
            .where(UserRow.id == source.id).with_for_update())).first()
        if previous is None:
            return None
        if previous.email_key != canonical_email(source.email) or previous.is_active != source.is_active:
            # Returning to a former address/active state must not resurrect proof.
            await self.session.execute(delete(AdminGrantRow).where(AdminGrantRow.user_id == source.id))
        values = asdict(source)
        for field in ("id", "roles", "created_at"):
            values.pop(field)
        values["email_key"] = canonical_email(source.email)
        with translate_constraints():
            row = await self.session.scalar(
                update(UserRow)
                .where(UserRow.id == source.id)
                .values(**values)
                .returning(UserRow)
                .execution_options(populate_existing=True)
            )
        return (await self._entities([row]))[0] if row is not None else None

    async def delete(self, user_id: str) -> UserEntity | None:
        row = await self.session.scalar(
            delete(UserRow).where(UserRow.id == user_id).returning(UserRow)
        )
        return user_entity(row) if row is not None else None

    async def update_profile_names(self, user_id: str, *, first_name: str | None,
                                   last_name: str | None, updated_at: datetime) -> UserEntity | None:
        values = {"updated_at": updated_at}
        if first_name is not None:
            values["first_name"] = first_name
        if last_name is not None:
            values["last_name"] = last_name
        row = await self.session.scalar(update(UserRow)
            .where(UserRow.id == user_id, UserRow.is_active.is_(True))
            .values(**values).returning(UserRow).execution_options(populate_existing=True))
        return (await self._entities([row]))[0] if row is not None else None

    async def assign_role(self, user_id: str, role_id: str) -> UserEntity:
        if await self.get_by_id(user_id) is None:
            raise ResourceNotFoundException("User", user_id)
        if await self.session.scalar(select(RoleRow.id).where(RoleRow.id == role_id)) is None:
            raise ResourceNotFoundException("Role", role_id)
        with translate_constraints():
            await self.session.execute(
                insert(user_roles).values(user_id=user_id, role_id=role_id)
            )
        result = await self.get_by_id(user_id)
        if result is None:
            raise ResourceNotFoundException("User", user_id)
        return result

    async def remove_role(self, user_id: str, role_id: str) -> UserEntity:
        if await self.get_by_id(user_id) is None:
            raise ResourceNotFoundException("User", user_id)
        await self.session.execute(
            delete(user_roles).where(
                user_roles.c.user_id == user_id, user_roles.c.role_id == role_id
            )
        )
        result = await self.get_by_id(user_id)
        if result is None:
            raise ResourceNotFoundException("User", user_id)
        return result
