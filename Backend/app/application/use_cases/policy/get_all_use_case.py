"""
True Clean Architecture Use Case for getting all policies.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass
from typing import List

from app.domain.entities import PolicyEntity
from app.interface.repository.policy_repository_interface import IPolicyRepository


@dataclass(frozen=True)
class GetAllPoliciesRequest:
    """Input port for getting all policies."""
    pass


@dataclass(frozen=True)
class GetAllPoliciesResponse:
    """Output port for getting all policies."""
    policies: List[PolicyEntity]


class GetAllPoliciesUseCase:
    """Use case for retrieving all policies."""

    def __init__(self, policy_repository: IPolicyRepository):
        self._policy_repo = policy_repository

    async def execute(self, request: GetAllPoliciesRequest) -> GetAllPoliciesResponse:
        """Execute the use case to get all policies."""
        policies = await self._policy_repo.get_all()
        return GetAllPoliciesResponse(policies=policies)
