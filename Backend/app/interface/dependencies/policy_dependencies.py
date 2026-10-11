"""Policy-related dependencies and dependency injection logic."""

from fastapi import Depends

from app.application.use_cases.policy import (
    GetAllPoliciesUseCase,
    GetPolicyByIdUseCase,
    GetPolicyByTitleUseCase,
    SearchPoliciesUseCase,
)
from app.application.use_cases.policy_engine import (
    EvaluatePoliciesUseCase,
)
from app.infra.repositories.json.policy_repository import JSONPolicyRepository
from app.interface.repository.policy_repository_interface import (
    IPolicyRepository,
)


async def get_policy_repository() -> IPolicyRepository:
    """Dependency to provide JSONPolicyRepository instance."""
    return JSONPolicyRepository()


async def get_get_all_policies_usecase(
    policy_repository: IPolicyRepository = Depends(get_policy_repository),
) -> GetAllPoliciesUseCase:
    """Dependency to provide GetAllPoliciesUseCase instance."""
    return GetAllPoliciesUseCase(policy_repository)


async def get_get_policy_by_id_usecase(
    policy_repository: IPolicyRepository = Depends(get_policy_repository),
) -> GetPolicyByIdUseCase:
    """Dependency to provide GetPolicyByIdUseCase instance."""
    return GetPolicyByIdUseCase(policy_repository)


async def get_get_policy_by_title_usecase(
    policy_repository: IPolicyRepository = Depends(get_policy_repository),
) -> GetPolicyByTitleUseCase:
    """Dependency to provide GetPolicyByTitleUseCase instance."""
    return GetPolicyByTitleUseCase(policy_repository)


async def get_search_policies_usecase(
    policy_repository: IPolicyRepository = Depends(get_policy_repository),
) -> SearchPoliciesUseCase:
    """Dependency to provide SearchPoliciesUseCase instance."""
    return SearchPoliciesUseCase(policy_repository)


async def get_policy_engine_usecase(
    policy_repository: IPolicyRepository = Depends(get_policy_repository),
) -> EvaluatePoliciesUseCase:
    """Dependency to provide EvaluatePoliciesUseCase instance."""
    return EvaluatePoliciesUseCase(policy_repository)
