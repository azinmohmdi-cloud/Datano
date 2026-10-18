from abc import ABC, abstractmethod

from app.application.use_cases.auth.session_models import SessionRecord


class ISessionRepository(ABC):
    """Digest-only storage; all operations participate in the caller's transaction."""

    @abstractmethod
    async def create(self, digest: bytes, user_id: str, *, remember_me: bool,
                     idle_seconds: int, absolute_seconds: int) -> SessionRecord:
        raise NotImplementedError

    @abstractmethod
    async def resolve(self, digest: bytes, *, touch: bool = True) -> SessionRecord | None:
        raise NotImplementedError

    @abstractmethod
    async def revoke(self, digest: bytes) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def revoke_all(self, user_id: str) -> int:
        raise NotImplementedError

    @abstractmethod
    async def rotate(self, previous_digest: bytes, digest: bytes, user_id: str, *,
                     remember_me: bool, idle_seconds: int, absolute_seconds: int) -> SessionRecord:
        """Create a fresh session and revoke the previous one in the caller's transaction."""
        raise NotImplementedError
