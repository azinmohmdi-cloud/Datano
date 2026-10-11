"""
True Clean Architecture Use Case for searching policies.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass
from typing import List

from app.domain.entities import PolicyEntity
from app.interface.repository.policy_repository_interface import IPolicyRepository


@dataclass(frozen=True)
class SearchPoliciesRequest:
    """Input port for searching policies by title."""
    title_query: str


@dataclass(frozen=True)
class SearchPoliciesResponse:
    """Output port for searching policies by title."""
    policies: List[PolicyEntity]


class SearchPoliciesUseCase:
    """Use case for searching policies by title."""

    def __init__(self, policy_repository: IPolicyRepository):
        self._policy_repo = policy_repository

    async def execute(
        self, request: SearchPoliciesRequest
    ) -> SearchPoliciesResponse:
        """Execute the use case to search policies by title."""
        policies = await self._policy_repo.search_by_title(request.title_query)
        return SearchPoliciesResponse(policies=policies)
