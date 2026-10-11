from fastapi_pagination import Params

from app.infra.repositories.in_memory.registry import (
    permission_repository,
    role_repository,
    user_repository,
)
from app.infra.services.password_service import BcryptPasswordService


async def seed():
    from app.application.use_cases.role import (
        AssignPermissionRequest,
        AssignPermissionToRoleUseCase,
        CreateRoleRequest,
        CreateRoleUseCase,
    )
    from app.application.use_cases.user import (
        AssignRoleRequest,
        AssignRoleToUserUseCase,
        CreateUserRequest,
        CreateUserUseCase,
    )

    existing = await role_repository.get_all(Params(page=1, size=100))
    if existing.items:
        return

    create_role_uc = CreateRoleUseCase(role_repository, permission_repository)
    result = await create_role_uc.execute(CreateRoleRequest(name="Admin"))
    role = result.role

    perm = await permission_repository.get_by_title("super:user")
    if perm:
        assign_perm_uc = AssignPermissionToRoleUseCase(
            role_repository, permission_repository
        )
        await assign_perm_uc.execute(
            AssignPermissionRequest(role_id=role.id, permission_id=perm.id)
        )

    password_service = BcryptPasswordService()
    create_user_uc = CreateUserUseCase(user_repository, password_service)
    result = await create_user_uc.execute(
        CreateUserRequest(
            first_name="Admin",
            last_name="User",
            email="admin@example.com",
            username="admin",
            password="Secret123",
        )
    )
    user = result.user

    assign_role_uc = AssignRoleToUserUseCase(user_repository, role_repository)
    await assign_role_uc.execute(
        AssignRoleRequest(user_id=user.id, role_id=role.id)
    )

    user.activate()
    await user_repository.update(user)
