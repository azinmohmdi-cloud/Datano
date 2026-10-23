from abc import ABC, abstractmethod

from app.application.use_cases.integration.credentials import OAuthCredential
from app.domain.entities.integration_entity import IntegrationEntity, IntegrationSource


class IIntegrationRepository(ABC):
    """Internal persistence port. Caller owns the transaction and trusted identity.

    The provider adapter must prove resource permission/website association before
    selecting a property. Storage does not constitute OAuth or provider approval.
    """

    @abstractmethod
    async def save_selection(self, owner_id: str, website_id: str, source: IntegrationSource,
        property_id: str, credential: OAuthCredential | None, *, expected: IntegrationEntity | None) -> IntegrationEntity:
        """CAS selection. None expects no active record. Same-property None token
        preserves its credential; a new identity requires an explicit credential.
        Different properties always receive new IDs, including A -> B -> A.
        """

    @abstractmethod
    async def get_active(self, owner_id: str, website_id: str, source: IntegrationSource) -> IntegrationEntity | None:
        """Only metadata for this active owner's verified current site."""

    @abstractmethod
    async def get_by_id(self, owner_id: str, website_id: str, integration_id: str) -> IntegrationEntity | None:
        """Owner-scoped metadata, including retired identity for history references."""

    @abstractmethod
    async def get_credential(self, owner_id: str, website_id: str, integration_id: str) -> OAuthCredential:
        """Explicit secret read; retired, foreign or inaccessible records fail closed."""
