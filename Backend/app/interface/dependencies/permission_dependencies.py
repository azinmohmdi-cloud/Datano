"""
Permission-related dependencies and dependency injection logic.
"""

from fastapi import Depends

from app.application.use_cases.permission import (
    GetAllPermissionsUseCase,
    GetPermissionByIdUseCase,
    GetPermissionByTitleUseCase,
    SearchPermissionsUseCase,
)
from app.infra.repositories.json.permission_repository import (
    JSONPermissionRepository,
)
from app.interface.repository.permission_repository_interface import (
    IPermissionRepository,
)


async def get_permission_repository() -> IPermissionRepository:
    """Dependency to provide JSONPermissionRepository instance."""
    return JSONPermissionRepository()


async def get_get_all_permissions_usecase(
    permission_repository: IPermissionRepository = Depends(get_permission_repository),
) -> GetAllPermissionsUseCase:
    """Dependency to provide GetAllPermissionsUseCase instance."""
    return GetAllPermissionsUseCase(permission_repository)


async def get_get_permission_by_id_usecase(
    permission_repository: IPermissionRepository = Depends(get_permission_repository),
) -> GetPermissionByIdUseCase:
    """Dependency to provide GetPermissionByIdUseCase instance."""
    return GetPermissionByIdUseCase(permission_repository)


async def get_get_permission_by_title_usecase(
    permission_repository: IPermissionRepository = Depends(get_permission_repository),
) -> GetPermissionByTitleUseCase:
    """Dependency to provide GetPermissionByTitleUseCase instance."""
    return GetPermissionByTitleUseCase(permission_repository)


async def get_search_permissions_usecase(
    permission_repository: IPermissionRepository = Depends(get_permission_repository),
) -> SearchPermissionsUseCase:
    """Dependency to provide SearchPermissionsUseCase instance."""
    return SearchPermissionsUseCase(permission_repository)
