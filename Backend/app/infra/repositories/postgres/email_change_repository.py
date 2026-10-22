from collections.abc import Awaitable, Callable
from dataclasses import replace
from datetime import datetime
from functools import wraps
import hashlib
import hmac
import json
from typing import ParamSpec, TypeVar

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.auth.admin_policy import AdminEmailPolicy, admin_role_state
from app.application.use_cases.auth.email_change import EmailChangeActor, email_change_target, invalid_email_change
from app.application.use_cases.auth.session_models import SessionRecord
from app.domain.error.exceptions import ConflictException, ServiceUnavailableException
from app.infra.database.connection import Database
from app.infra.database.models import AdminGrantRow, RecoveryGrantRow, RoleRow, SessionRow, UserRow, user_roles
from app.infra.repositories.postgres.mapping import role_entity
from app.infra.repositories.postgres.session_repository import SQLSessionRepository
from app.interface.repository.email_change_repository_interface import IEmailChangeRepository

P = ParamSpec("P")
T = TypeVar("T")


def safe_email_change_storage(operation: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
    @wraps(operation)
    async def wrapped(*args: P.args, **kwargs: P.kwargs) -> T:
        duplicate = False
        try:
            return await operation(*args, **kwargs)
        except IntegrityError as error:
            duplicate = (getattr(error.orig, "sqlstate", None) == "23505"
                and getattr(getattr(error.orig, "diag", None), "constraint_name", None) in {"uq_users_email", "uq_users_email_key"})
        except SQLAlchemyError:
            pass
        # Raise outside except so raw SQL/driver secrets have no exception context.
        if duplicate:
            raise ConflictException("Email address is unavailable")
        raise ServiceUnavailableException("Email change is temporarily unavailable")
    return wrapped


class PostgresEmailChangeRepository(IEmailChangeRepository):
    def __init__(self, database: Database, eligibility: AdminEmailPolicy,
                 *, clock: Callable[[], datetime] | None = None) -> None:
        self.database, self.eligibility, self.clock = database, eligibility, clock

    @staticmethod
    def _state(user: UserRow) -> bytes:
        return hashlib.sha256(json.dumps(["datano-email-change-account-v1", user.id,
            user.email_key, user.hashed_password], separators=(",", ":")).encode()).digest()

    async def _actor(self, session: AsyncSession, digest: bytes) -> EmailChangeActor | None:
        record = await SQLSessionRepository(session, clock=self.clock).resolve(digest, touch=False)
        if record is None:
            return None
        user = await session.scalar(select(UserRow).where(UserRow.id == record.user_id)
            .execution_options(populate_existing=True))
        return EmailChangeActor(user.id, user.email_key, self._state(user), record) if user is not None and user.is_active else None

    @safe_email_change_storage
    async def actor(self, digest: bytes) -> EmailChangeActor | None:
        async with self.database.transaction() as session:
            return await self._actor(session, digest)

    @safe_email_change_storage
    async def available(self, email: str) -> bool:
        async with self.database.transaction() as session:
            return await session.scalar(select(UserRow.id).where(UserRow.email_key == email)) is None

    async def _authority(self, session: AsyncSession, user_id: str, email: str, now: datetime) -> None:
        # Delete former authority even if its role is inactive. Returning to an
        # old address must never revive old proof or a raw Admin assignment.
        await session.execute(delete(AdminGrantRow).where(AdminGrantRow.user_id == user_id))
        await session.execute(delete(user_roles).where(user_roles.c.user_id == user_id,
            user_roles.c.role_id.in_(select(RoleRow.id).where(RoleRow.name == "Admin"))))
        user_role = await session.scalar(select(RoleRow).where(RoleRow.name == "User", RoleRow.is_active.is_(True)))
        if user_role is not None:
            await session.execute(insert(user_roles).values(user_id=user_id, role_id=user_role.id).on_conflict_do_nothing())
        if self.eligibility.allows(email):
            role = await session.scalar(select(RoleRow).where(RoleRow.name == "Admin", RoleRow.is_active.is_(True)))
            if role is not None:
                session.add(AdminGrantRow(user_id=user_id, email_key=email, role_id=role.id,
                    role_state=admin_role_state(role_entity(role)), verified_at=now, method="email"))
                await session.execute(insert(user_roles).values(user_id=user_id, role_id=role.id).on_conflict_do_nothing())

    @safe_email_change_storage
    async def replace_email(self, actor: EmailChangeActor, email: str, digest: bytes,
                            *, idle_seconds: int, absolute_seconds: int) -> SessionRecord | None:
        email = email_change_target(email)
        async with self.database.transaction() as session:
            current = await self._actor(session, actor.session.digest)
            if (current is None or current.user_id != actor.user_id or current.email != actor.email
                    or email == current.email or not hmac.compare_digest(current.account_state, actor.account_state)):
                return None
            now = self.clock() if self.clock else await session.scalar(select(func.clock_timestamp()))
            await session.execute(update(UserRow).where(UserRow.id == current.user_id)
                .values(email=email, email_key=email, updated_at=now))
            await self._authority(session, current.user_id, email, now)
            await session.execute(delete(RecoveryGrantRow).where(RecoveryGrantRow.user_id == current.user_id))
            sessions = SQLSessionRepository(session, clock=self.clock)
            await sessions.revoke_all(current.user_id)
            record = await sessions.create(digest, current.user_id, remember_me=current.session.remember_me,
                idle_seconds=idle_seconds, absolute_seconds=absolute_seconds)
            if not current.session.is_valid_at(record.created_at):
                raise invalid_email_change()
            absolute = min(record.absolute_expires_at, current.session.absolute_expires_at)
            idle = min(record.idle_expires_at, absolute)
            await session.execute(update(SessionRow).where(SessionRow.digest == digest)
                .values(absolute_expires_at=absolute, idle_expires_at=idle))
            return replace(record, absolute_expires_at=absolute, idle_expires_at=idle)
