"""
True Clean Architecture Use Case for getting a policy by ID.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass

from app.domain.entities import PolicyEntity
from app.domain.error.exceptions import ResourceNotFoundException
from app.interface.repository.policy_repository_interface import IPolicyRepository


@dataclass(frozen=True)
class GetPolicyByIdRequest:
    """Input port for getting a policy by ID."""
    policy_id: str


@dataclass(frozen=True)
class GetPolicyByIdResponse:
    """Output port for getting a policy by ID."""
    policy: PolicyEntity


class GetPolicyByIdUseCase:
    """Use case for retrieving a policy by ID."""

    def __init__(self, policy_repository: IPolicyRepository):
        self._policy_repo = policy_repository

    async def execute(
        self, request: GetPolicyByIdRequest
    ) -> GetPolicyByIdResponse:
        """Execute the use case to get a policy by ID."""
        policy = await self._policy_repo.get_by_id(request.policy_id)
        if policy is None:
            raise ResourceNotFoundException(
                resource_type="Policy", identifier=request.policy_id
            )
        return GetPolicyByIdResponse(policy=policy)
