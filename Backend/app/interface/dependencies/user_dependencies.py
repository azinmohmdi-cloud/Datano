"""
User-related dependencies and dependency injection logic.
"""

from fastapi import Depends

from app.application.use_cases.auth.interfaces import IPasswordService
from app.application.use_cases.user import (
    AssignRoleToUserUseCase,
    CreateUserUseCase,
    DeleteUserUseCase,
    GetAllUsersUseCase,
    GetUserByIdUseCase,
    RemoveRoleFromUserUseCase,
    UpdateUserUseCase,
)
from app.infra.repositories.in_memory.registry import (
    role_repository as _in_memory_role_repository,
)
from app.infra.repositories.in_memory.registry import (
    user_repository as _in_memory_user_repository,
)
from app.interface.repository.role_repository_interface import IRoleRepository
from app.interface.repository.user_repository_interface import IUserRepository


def get_password_service() -> IPasswordService:
    """Dependency to provide password service instance."""
    from app.infra.services import BcryptPasswordService
    return BcryptPasswordService()


async def get_user_repository() -> IUserRepository:
    """Dependency to provide UserRepository instance."""
    return _in_memory_user_repository


async def get_role_repository() -> IRoleRepository:
    """Dependency to provide RoleRepository instance."""
    return _in_memory_role_repository


async def get_get_all_users_usecase(
    user_repository: IUserRepository = Depends(get_user_repository),
) -> GetAllUsersUseCase:
    """Dependency to provide GetAllUsersUseCase instance."""
    return GetAllUsersUseCase(user_repository)


async def get_get_user_by_id_usecase(
    user_repository: IUserRepository = Depends(get_user_repository),
) -> GetUserByIdUseCase:
    """Dependency to provide GetUserByIdUseCase instance."""
    return GetUserByIdUseCase(user_repository)


async def get_create_user_usecase(
    user_repository: IUserRepository = Depends(get_user_repository),
    password_service: IPasswordService = Depends(get_password_service),
) -> CreateUserUseCase:
    """Dependency to provide CreateUserUseCase instance."""
    return CreateUserUseCase(user_repository, password_service)


async def get_update_user_usecase(
    user_repository: IUserRepository = Depends(get_user_repository),
) -> UpdateUserUseCase:
    """Dependency to provide UpdateUserUseCase instance."""
    return UpdateUserUseCase(user_repository)


async def get_delete_user_usecase(
    user_repository: IUserRepository = Depends(get_user_repository),
) -> DeleteUserUseCase:
    """Dependency to provide DeleteUserUseCase instance."""
    return DeleteUserUseCase(user_repository)


async def get_assign_role_to_user_usecase(
    user_repository: IUserRepository = Depends(get_user_repository),
    role_repository: IRoleRepository = Depends(get_role_repository),
) -> AssignRoleToUserUseCase:
    """Dependency to provide AssignRoleToUserUseCase instance."""
    return AssignRoleToUserUseCase(user_repository, role_repository)


async def get_remove_role_from_user_usecase(
    user_repository: IUserRepository = Depends(get_user_repository),
    role_repository: IRoleRepository = Depends(get_role_repository),
) -> RemoveRoleFromUserUseCase:
    """Dependency to provide RemoveRoleFromUserUseCase instance."""
    return RemoveRoleFromUserUseCase(user_repository, role_repository)
