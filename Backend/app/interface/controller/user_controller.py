from fastapi import APIRouter, Depends
from fastapi_pagination import Page, Params

from app.application.use_cases import (
    AssignRoleToUserUseCase,
    CreateUserUseCase,
    DeleteUserUseCase,
    GetAllUsersUseCase,
    GetUserByIdUseCase,
    RemoveRoleFromUserUseCase,
    UpdateUserUseCase,
)
from app.application.use_cases.user import (
    AssignRoleRequest,
    CreateUserRequest,
    DeleteUserRequest,
    GetAllUsersRequest,
    GetUserByIdRequest,
    RemoveRoleRequest,
    UpdateUserRequest,
)
from app.infra.utils.auth.permission import Permission
from app.interface.dependencies.auth_dependencies import get_authorized_user
from app.interface.dependencies.user_dependencies import (
    get_assign_role_to_user_usecase,
    get_create_user_usecase,
    get_delete_user_usecase,
    get_get_all_users_usecase,
    get_get_user_by_id_usecase,
    get_remove_role_from_user_usecase,
    get_update_user_usecase,
)
from app.interface.dto import User, UserCreate, UserUpdate
from app.interface.dto.responses import StandardResponse, success

# Create router with prefix and tags
user_router = APIRouter(prefix="/users", tags=["users"])


@user_router.get("/", response_model=StandardResponse[Page[User]])
async def get_users(
    usecase: GetAllUsersUseCase = Depends(get_get_all_users_usecase),
    params: Params = Depends(),
    _=Depends(get_authorized_user([Permission.Users_Read])),
):
    """Get a list of all users"""
    result = await usecase.execute(
        GetAllUsersRequest(page=params.page, size=params.size)
    )

    from app.interface.mappers import UserMapper

    users_dto = [UserMapper.to_dto(user) for user in result.users]
    pages = (result.total + result.size - 1) // result.size if result.total else 1
    return success(
        message="Users retrieved successfully",
        payload=Page(
            items=users_dto,
            total=result.total,
            page=result.page,
            size=result.size,
            pages=pages,
        ),
    )


@user_router.post("/", response_model=StandardResponse[User])
async def create_user(
    user_create: UserCreate,
    usecase: CreateUserUseCase = Depends(get_create_user_usecase),
    _=Depends(get_authorized_user([Permission.Users_Create])),
):
    """Create a new user"""
    result = await usecase.execute(
        CreateUserRequest(
            first_name=user_create.first_name,
            last_name=user_create.last_name,
            email=user_create.email,
            username=user_create.username,
            password=user_create.password,
        )
    )
    from app.interface.mappers import UserMapper

    user_dto = UserMapper.to_dto(result.user)
    return success(message="User created successfully", payload=user_dto)


@user_router.get("/{user_id}", response_model=StandardResponse[User])
async def get_user(
    user_id: str,
    usecase: GetUserByIdUseCase = Depends(get_get_user_by_id_usecase),
    _=Depends(get_authorized_user([Permission.Users_Read])),
):
    """Get a specific user by ID"""
    result = await usecase.execute(GetUserByIdRequest(user_id=user_id))
    from app.interface.mappers import UserMapper

    user_dto = UserMapper.to_dto(result.user)
    return success(message="User retrieved successfully", payload=user_dto)


@user_router.put("/{user_id}", response_model=StandardResponse[User])
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    usecase: UpdateUserUseCase = Depends(get_update_user_usecase),
    _=Depends(get_authorized_user([Permission.Users_Update])),
):
    """Update a specific user by ID"""
    result = await usecase.execute(
        UpdateUserRequest(
            user_id=user_id,
            first_name=user_update.first_name,
            last_name=user_update.last_name,
            email=user_update.email,
            username=user_update.username,
            is_active=user_update.is_active,
        )
    )
    from app.interface.mappers import UserMapper

    user_dto = UserMapper.to_dto(result.user)
    return success(message="User updated successfully", payload=user_dto)


@user_router.delete("/{user_id}", response_model=StandardResponse[User])
async def delete_user(
    user_id: str,
    usecase: DeleteUserUseCase = Depends(
        get_delete_user_usecase,
    ),
    _=Depends(get_authorized_user([Permission.Users_Delete])),
):
    """Delete a specific user by ID"""
    result = await usecase.execute(DeleteUserRequest(user_id=user_id))
    from app.interface.mappers import UserMapper

    user_dto = UserMapper.to_dto(result.user)
    return success(message="User deleted successfully", payload=user_dto)


@user_router.post("/{user_id}/roles/{role_id}", response_model=StandardResponse[User])
async def assign_role_to_user(
    user_id: str,
    role_id: str,
    usecase: AssignRoleToUserUseCase = Depends(get_assign_role_to_user_usecase),
    _=Depends(get_authorized_user([Permission.Users_AssignRole])),
):
    """Assign a role to a user"""
    result = await usecase.execute(AssignRoleRequest(user_id=user_id, role_id=role_id))
    from app.interface.mappers import UserMapper

    user_dto = UserMapper.to_dto(result.user)
    return success(message="Role assigned to user successfully", payload=user_dto)


@user_router.delete("/{user_id}/roles/{role_id}", response_model=StandardResponse[User])
async def remove_role_from_user(
    user_id: str,
    role_id: str,
    usecase: RemoveRoleFromUserUseCase = Depends(get_remove_role_from_user_usecase),
    _=Depends(get_authorized_user([Permission.Users_UnassignRole])),
):
    """Remove a role from a user"""
    result = await usecase.execute(RemoveRoleRequest(user_id=user_id, role_id=role_id))
    from app.interface.mappers import UserMapper

    user_dto = UserMapper.to_dto(result.user)
    return success(message="Role removed from user successfully", payload=user_dto)
