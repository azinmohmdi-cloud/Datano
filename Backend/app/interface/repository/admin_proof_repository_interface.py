from abc import ABC, abstractmethod

from app.application.use_cases.auth.admin_email import AdminActor
from app.application.use_cases.auth.session_models import SessionRecord


class IAdminProofRepository(ABC):
    @abstractmethod
    async def actor(self, digest: bytes) -> AdminActor | None:
        raise NotImplementedError

    @abstractmethod
    async def promote(self, actor: AdminActor, digest: bytes, *, idle_seconds: int, absolute_seconds: int) -> SessionRecord | None:
        """Atomically recheck eligibility, grant authority and replace all sessions."""
        raise NotImplementedError

    @abstractmethod
    async def provision(self, user_id: str) -> bool:
        """Trusted private operator path; revoke sessions and require fresh login."""
        raise NotImplementedError
