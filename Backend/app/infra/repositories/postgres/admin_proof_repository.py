from collections.abc import Awaitable, Callable
from dataclasses import replace
from datetime import datetime
from functools import wraps
import hashlib
import hmac
import json
from typing import ParamSpec, TypeVar

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.auth.admin_email import AdminActor, invalid_admin_proof
from app.application.use_cases.auth.admin_policy import AdminEmailPolicy, admin_role_state
from app.application.use_cases.auth.session_models import SessionRecord
from app.domain.error.exceptions import ServiceUnavailableException
from app.infra.database.connection import Database
from app.infra.database.models import AdminGrantRow, RoleRow, SessionRow, UserRow, user_roles
from app.infra.repositories.postgres.mapping import role_entity
from app.infra.repositories.postgres.session_repository import SQLSessionRepository
from app.interface.repository.admin_proof_repository_interface import IAdminProofRepository

P = ParamSpec("P")
T = TypeVar("T")


def safe_admin_storage(operation: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
    @wraps(operation)
    async def wrapped(*args: P.args, **kwargs: P.kwargs) -> T:
        try:
            return await operation(*args, **kwargs)
        except SQLAlchemyError:
            pass
        raise ServiceUnavailableException("Administrator authority is temporarily unavailable")
    return wrapped


class PostgresAdminProofRepository(IAdminProofRepository):
    def __init__(self, database: Database, eligibility: AdminEmailPolicy,
                 *, clock: Callable[[], datetime] | None = None) -> None:
        self.database, self.eligibility, self.clock = database, eligibility, clock

    @staticmethod
    def _state(user: UserRow) -> bytes:
        return hashlib.sha256(json.dumps(["datano-admin-account-v1", user.id,
            user.email_key, user.hashed_password], separators=(",", ":")).encode()).digest()

    async def _actor(self, session: AsyncSession, digest: bytes) -> AdminActor | None:
        record = await SQLSessionRepository(session, clock=self.clock).resolve(digest, touch=False)
        if record is None:
            return None
        user = await session.scalar(select(UserRow).where(UserRow.id == record.user_id)
            .execution_options(populate_existing=True))
        return AdminActor(user.id, user.email_key, self._state(user), record) if user is not None and user.is_active else None

    @safe_admin_storage
    async def actor(self, digest: bytes) -> AdminActor | None:
        async with self.database.transaction() as session:
            return await self._actor(session, digest)

    async def _grant(self, session: AsyncSession, user_id: str, email: str, method: str) -> bool:
        if not self.eligibility.allows(email):
            return False
        role = await session.scalar(select(RoleRow).where(RoleRow.name == "Admin", RoleRow.is_active.is_(True)))
        if role is None:
            return False
        now = self.clock() if self.clock else await session.scalar(select(func.clock_timestamp()))
        if now.tzinfo is None or now.utcoffset() is None:
            raise ValueError("Administrator clock must be timezone aware")
        values = {"user_id":user_id, "email_key":email, "role_id":role.id,
            "role_state":admin_role_state(role_entity(role)), "verified_at":now, "method":method}
        await session.execute(insert(AdminGrantRow).values(**values).on_conflict_do_update(
            index_elements=[AdminGrantRow.user_id], set_=values))
        await session.execute(insert(user_roles).values(user_id=user_id,role_id=role.id).on_conflict_do_nothing())
        await SQLSessionRepository(session, clock=self.clock).revoke_all(user_id)
        return True

    @safe_admin_storage
    async def promote(self, actor: AdminActor, digest: bytes, *, idle_seconds: int, absolute_seconds: int) -> SessionRecord | None:
        async with self.database.transaction() as session:
            current = await self._actor(session, actor.session.digest)
            if (current is None or current.user_id != actor.user_id or current.email != actor.email
                    or not hmac.compare_digest(current.account_state, actor.account_state)):
                return None
            if not await self._grant(session,current.user_id,current.email,"email"):
                return None
            record = await SQLSessionRepository(session,clock=self.clock).create(digest,current.user_id,
                remember_me=current.session.remember_me,idle_seconds=idle_seconds,absolute_seconds=absolute_seconds)
            if not current.session.is_valid_at(record.created_at):
                # A lock wait must not turn an expired session into Admin. Raising
                # inside the UoW rolls back grant, role, revocations and issuance.
                raise invalid_admin_proof()
            # Elevation rotates the identifier; it does not extend the original cap.
            absolute = min(record.absolute_expires_at,current.session.absolute_expires_at)
            idle = min(record.idle_expires_at,absolute)
            await session.execute(update(SessionRow).where(SessionRow.digest == digest)
                .values(absolute_expires_at=absolute,idle_expires_at=idle))
            return replace(record,absolute_expires_at=absolute,idle_expires_at=idle)

    @safe_admin_storage
    async def provision(self, user_id: str) -> bool:
        async with self.database.transaction() as session:
            user = await session.scalar(select(UserRow).where(UserRow.id == user_id).with_for_update())
            return (user is not None and user.is_active
                and await self._grant(session,user.id,user.email_key,"provisioning"))
