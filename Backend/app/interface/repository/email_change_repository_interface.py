from abc import ABC, abstractmethod

from app.application.use_cases.auth.email_change import EmailChangeActor
from app.application.use_cases.auth.session_models import SessionRecord


class IEmailChangeRepository(ABC):
    @abstractmethod
    async def actor(self, digest: bytes) -> EmailChangeActor | None:
        """Read the active, session-owned account in a short transaction."""

    @abstractmethod
    async def available(self, email: str) -> bool:
        """Dispatch hint only; the final unique constraint is authoritative."""

    @abstractmethod
    async def replace_email(self, actor: EmailChangeActor, email: str, digest: bytes,
                            *, idle_seconds: int, absolute_seconds: int) -> SessionRecord | None:
        """Recheck proof state; atomically replace email, authority and sessions."""
