"""Interface for policy repository operations."""

from abc import ABC, abstractmethod
from typing import List, Optional

from app.domain.entities import PolicyEntity


class IPolicyRepository(ABC):
    """Interface for policy repository operations."""

    @abstractmethod
    async def get_by_id(self, policy_id: str) -> Optional[PolicyEntity]:
        """Get a policy by ID from the repository."""

    @abstractmethod
    async def get_by_title(self, title: str) -> Optional[PolicyEntity]:
        """Get a policy by title from the repository."""

    @abstractmethod
    async def get_all(self) -> List[PolicyEntity]:
        """Get all policies from the repository."""

    @abstractmethod
    async def search_by_title(self, title_query: str) -> List[PolicyEntity]:
        """Search policies by title from the repository."""
