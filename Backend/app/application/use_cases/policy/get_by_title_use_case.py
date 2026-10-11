"""
True Clean Architecture Use Case for getting a policy by title.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass

from app.domain.entities import PolicyEntity
from app.domain.error.exceptions import ResourceNotFoundException
from app.interface.repository.policy_repository_interface import IPolicyRepository


@dataclass(frozen=True)
class GetPolicyByTitleRequest:
    """Input port for getting a policy by title."""
    title: str


@dataclass(frozen=True)
class GetPolicyByTitleResponse:
    """Output port for getting a policy by title."""
    policy: PolicyEntity


class GetPolicyByTitleUseCase:
    """Use case for retrieving a policy by title."""

    def __init__(self, policy_repository: IPolicyRepository):
        self._policy_repo = policy_repository

    async def execute(
        self, request: GetPolicyByTitleRequest
    ) -> GetPolicyByTitleResponse:
        """Execute the use case to get a policy by title."""
        policy = await self._policy_repo.get_by_title(request.title)
        if policy is None:
            raise ResourceNotFoundException(
                resource_type="Policy", identifier=request.title
            )
        return GetPolicyByTitleResponse(policy=policy)
