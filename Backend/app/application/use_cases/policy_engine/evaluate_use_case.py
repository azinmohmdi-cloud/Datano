"""
True Clean Architecture Use Case for evaluating policies.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass
from typing import List, Optional

from app.domain.entities import PolicyEntity
from app.domain.error.exceptions import ForbiddenException
from app.interface.repository.policy_repository_interface import IPolicyRepository


@dataclass(frozen=True)
class EvaluatePoliciesRequest:
    """Input port for evaluating policies."""
    policy_ids: List[str]
    context: Optional[dict] = None


@dataclass(frozen=True)
class EvaluatePoliciesResponse:
    """Output port for evaluating policies."""
    pass


class EvaluatePoliciesUseCase:
    """Use case for evaluating and validating policies."""

    def __init__(self, policy_repository: IPolicyRepository):
        self._policy_repo = policy_repository

    async def execute(self, request: EvaluatePoliciesRequest) -> EvaluatePoliciesResponse:
        """Execute the use case to evaluate policies."""
        if not request.policy_ids:
            return EvaluatePoliciesResponse()

        invalid_policy_ids = []
        policies: List[PolicyEntity] = []

        for policy_id in request.policy_ids:
            policy = await self._policy_repo.get_by_id(policy_id)
            if policy is None:
                invalid_policy_ids.append(policy_id)
            else:
                policies.append(policy)

        if invalid_policy_ids:
            raise ForbiddenException(
                message=f"Invalid or missing policies: {', '.join(invalid_policy_ids)}",
                details={"invalid_policy_ids": invalid_policy_ids},
            )

        for policy in policies:
            await self._evaluate_policy(policy, request.context)

        return EvaluatePoliciesResponse()

    async def _evaluate_policy(
        self,
        policy: PolicyEntity,
        context: Optional[dict] = None,
    ) -> None:
        """
        Evaluate a single policy.
        Extend this method to implement custom policy evaluation logic.
        """
        # Policy evaluation logic goes here
        # For now, this is a placeholder that can be extended
        pass
