"""
Role-related dependencies and dependency injection logic.
"""

from fastapi import Depends

from app.application.use_cases.role import (
    AssignPermissionToRoleUseCase,
    CreateRoleUseCase,
    DeleteRoleUseCase,
    GetAllRolesUseCase,
    GetRoleByIdUseCase,
    RemovePermissionFromRoleUseCase,
    UpdateRoleUseCase,
)
from app.infra.repositories.in_memory.registry import (
    role_repository as _in_memory_role_repository,
)
from app.infra.repositories.in_memory.registry import (
    permission_repository as _in_memory_permission_repository,
)
from app.interface.repository.permission_repository_interface import (
    IPermissionRepository,
)
from app.interface.repository.role_repository_interface import IRoleRepository


async def get_role_repository() -> IRoleRepository:
    """Dependency to provide RoleRepository instance."""
    return _in_memory_role_repository


async def get_permission_repository() -> IPermissionRepository:
    """Dependency to provide PermissionRepository instance."""
    return _in_memory_permission_repository


async def get_get_all_roles_usecase(
    role_repository: IRoleRepository = Depends(get_role_repository),
) -> GetAllRolesUseCase:
    """Dependency to provide GetAllRolesUseCase instance."""
    return GetAllRolesUseCase(role_repository)


async def get_get_role_by_id_usecase(
    role_repository: IRoleRepository = Depends(get_role_repository),
) -> GetRoleByIdUseCase:
    """Dependency to provide GetRoleByIdUseCase instance."""
    return GetRoleByIdUseCase(role_repository)


async def get_create_role_usecase(
    role_repository: IRoleRepository = Depends(get_role_repository),
    permission_repository: IPermissionRepository = Depends(get_permission_repository),
) -> CreateRoleUseCase:
    """Dependency to provide CreateRoleUseCase instance."""
    return CreateRoleUseCase(role_repository, permission_repository)


async def get_update_role_usecase(
    role_repository: IRoleRepository = Depends(get_role_repository),
    permission_repository: IPermissionRepository = Depends(get_permission_repository),
) -> UpdateRoleUseCase:
    """Dependency to provide UpdateRoleUseCase instance."""
    return UpdateRoleUseCase(role_repository, permission_repository)


async def get_delete_role_usecase(
    role_repository: IRoleRepository = Depends(get_role_repository),
) -> DeleteRoleUseCase:
    """Dependency to provide DeleteRoleUseCase instance."""
    return DeleteRoleUseCase(role_repository)


async def get_assign_permission_to_role_usecase(
    role_repository: IRoleRepository = Depends(get_role_repository),
    permission_repository: IPermissionRepository = Depends(get_permission_repository),
) -> AssignPermissionToRoleUseCase:
    """Dependency to provide AssignPermissionToRoleUseCase instance."""
    return AssignPermissionToRoleUseCase(role_repository, permission_repository)


async def get_remove_permission_from_role_usecase(
    role_repository: IRoleRepository = Depends(get_role_repository),
) -> RemovePermissionFromRoleUseCase:
    """Dependency to provide RemovePermissionFromRoleUseCase instance."""
    return RemovePermissionFromRoleUseCase(role_repository)
