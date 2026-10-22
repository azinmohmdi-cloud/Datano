from abc import ABC, abstractmethod
from datetime import datetime

from fastapi_pagination import Page, Params

from app.domain.entities.website_entity import WebsiteEntity


class IWebsiteRepository(ABC):
    @abstractmethod
    async def claim(self, candidate: WebsiteEntity) -> WebsiteEntity:
        """Atomically claim a hostname, reuse self, or raise a safe conflict.

        A verified claim never expires. Another owner's unverified reservation
        can be replaced only after expiry, with a fresh record/identifier.
        The supplied candidate must be new and have no verification state.
        """

    @abstractmethod
    async def get_by_id(self, website_id: str, owner_id: str) -> WebsiteEntity | None:
        """Read only this owner's current record; released records are excluded."""

    @abstractmethod
    async def get_by_owner(self, owner_id: str, params: Params) -> Page[WebsiteEntity]:
        """Stable, bounded pagination of this owner's current records."""

    @abstractmethod
    async def save_verification(self, source: WebsiteEntity, *, expected_updated_at: datetime) -> WebsiteEntity | None:
        """CAS persistence of already validated state; never a proof check.

        Preserve identity/owner/scheme/creation; reject stale, released or foreign
        records. The application must authorize and validate HTML proof first.
        """
