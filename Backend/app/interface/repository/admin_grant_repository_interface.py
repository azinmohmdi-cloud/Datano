from abc import ABC, abstractmethod

from app.domain.entities import RoleEntity


class IAdminGrantRepository(ABC):
    @abstractmethod
    async def verified(self, user_id: str, email: str, role: RoleEntity) -> bool:
        """Check server-owned authority bound to the current mailbox and role."""
        raise NotImplementedError
