from collections.abc import Awaitable, Callable
from dataclasses import asdict
from functools import wraps
from typing import ParamSpec, TypeVar

from sqlalchemy import delete, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.integration.credentials import ICredentialCipher, OAuthCredential
from app.domain.entities.integration_entity import IntegrationEntity, IntegrationSource, validate_identifier, validate_source
from app.domain.error.exceptions import ConflictException, ResourceNotFoundException, ServiceUnavailableException, ValidationException
from app.infra.database.models import IntegrationCredentialRow, IntegrationRow, UserRow, WebsiteRow
from app.infra.repositories.postgres.website_repository import lock_website_hostname
from app.interface.repository.integration_repository_interface import IIntegrationRepository

P = ParamSpec("P")
T = TypeVar("T")


def safe_storage(operation: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
    @wraps(operation)
    async def wrapped(*args: P.args, **kwargs: P.kwargs) -> T:
        try:
            return await operation(*args, **kwargs)
        except SQLAlchemyError:
            pass
        raise ServiceUnavailableException("Integration storage is unavailable") from None
    return wrapped


def integration_entity(row: IntegrationRow) -> IntegrationEntity:
    return IntegrationEntity(**{name: getattr(row, name) for name in IntegrationEntity.__dataclass_fields__})


class SQLIntegrationRepository(IIntegrationRepository):
    """Caller owns a short transaction. Never hold it across provider network I/O."""
    def __init__(self, session: AsyncSession, cipher: ICredentialCipher) -> None:
        self.session, self.cipher = session, cipher

    async def _site(self, owner_id: str, website_id: str, *, lock: bool = False) -> WebsiteRow:
        validate_identifier(owner_id)
        validate_identifier(website_id)
        account = select(UserRow.id).where(UserRow.id == owner_id, UserRow.is_active.is_(True))
        if lock:
            account = account.with_for_update()
        if await self.session.scalar(account) is None:
            raise ResourceNotFoundException("Website", "requested record")
        query = select(WebsiteRow).where(WebsiteRow.id == website_id, WebsiteRow.owner_id == owner_id,
            WebsiteRow.verified_at.is_not(None), WebsiteRow.released_at.is_(None))
        row = await self.session.scalar(query.execution_options(populate_existing=True))
        if row is None:
            raise ResourceNotFoundException("Website", "requested record")
        if lock:
            # Same account -> hostname -> website order as proof/claim operations.
            await lock_website_hostname(self.session, row.hostname)
            row = await self.session.scalar(query.with_for_update().execution_options(populate_existing=True))
            if row is None:
                raise ResourceNotFoundException("Website", "requested record")
        return row

    async def _active(self, owner_id: str, website_id: str, source: IntegrationSource) -> IntegrationRow | None:
        return await self.session.scalar(select(IntegrationRow).where(IntegrationRow.owner_id == owner_id,
            IntegrationRow.website_id == website_id, IntegrationRow.source == source,
            IntegrationRow.retired_at.is_(None)).execution_options(populate_existing=True))

    async def _credential(self, integration: IntegrationEntity) -> OAuthCredential:
        envelope = await self.session.scalar(select(IntegrationCredentialRow.ciphertext).where(
            IntegrationCredentialRow.integration_id == integration.id))
        if envelope is None:
            raise ServiceUnavailableException("Integration credential is unavailable")
        return self.cipher.decrypt(envelope, integration.credential_context())

    @safe_storage
    async def save_selection(self, owner_id: str, website_id: str, source: IntegrationSource,
        property_id: str, credential: OAuthCredential | None, *, expected: IntegrationEntity | None) -> IntegrationEntity:
        validate_source(source)
        validate_identifier(property_id, max_bytes=2048)
        await self._site(owner_id, website_id, lock=True)
        current_row = await self._active(owner_id, website_id, source)
        current = integration_entity(current_row) if current_row is not None else None
        if current != expected:
            raise ConflictException("Integration selection is no longer current")
        now = await self.session.scalar(select(func.clock_timestamp()))
        same_property = current is not None and current.property_id == property_id
        if credential is None:
            if not same_property:
                raise ValidationException("A new integration requires a credential")
            credential = await self._credential(current)
        candidate = (current.renew(now=now) if same_property
                     else IntegrationEntity.create(owner_id, website_id, source, property_id, now=now))
        # Encrypt before changing either identity or previous secret state.
        ciphertext = self.cipher.encrypt(credential, candidate.credential_context())
        if current_row is not None:
            stored = candidate if same_property else current.retire(now=now)
            for name, value in asdict(stored).items():
                setattr(current_row, name, value)
            await self.session.execute(delete(IntegrationCredentialRow).where(
                IntegrationCredentialRow.integration_id == current.id))
            await self.session.flush()
        if not same_property:
            self.session.add(IntegrationRow(**asdict(candidate)))
            await self.session.flush()
        self.session.add(IntegrationCredentialRow(integration_id=candidate.id, ciphertext=ciphertext))
        await self.session.flush()
        return candidate

    @safe_storage
    async def get_active(self, owner_id: str, website_id: str, source: IntegrationSource) -> IntegrationEntity | None:
        validate_source(source)
        await self._site(owner_id, website_id)
        row = await self._active(owner_id, website_id, source)
        return integration_entity(row) if row is not None else None

    @safe_storage
    async def get_by_id(self, owner_id: str, website_id: str, integration_id: str) -> IntegrationEntity | None:
        validate_identifier(integration_id)
        await self._site(owner_id, website_id)
        row = await self.session.scalar(select(IntegrationRow).where(IntegrationRow.id == integration_id,
            IntegrationRow.owner_id == owner_id, IntegrationRow.website_id == website_id).execution_options(populate_existing=True))
        return integration_entity(row) if row is not None else None

    @safe_storage
    async def get_credential(self, owner_id: str, website_id: str, integration_id: str) -> OAuthCredential:
        validate_identifier(integration_id)
        await self._site(owner_id, website_id, lock=True)
        row = await self.session.scalar(select(IntegrationRow).where(IntegrationRow.id == integration_id,
            IntegrationRow.owner_id == owner_id, IntegrationRow.website_id == website_id,
            IntegrationRow.retired_at.is_(None)).execution_options(populate_existing=True))
        if row is None:
            raise ResourceNotFoundException("Integration", "requested record")
        return await self._credential(integration_entity(row))
