from fastapi import APIRouter, Depends
from fastapi_pagination import Page, Params

from app.application.use_cases import (
    AssignPermissionToRoleUseCase,
    CreateRoleUseCase,
    DeleteRoleUseCase,
    GetAllRolesUseCase,
    GetRoleByIdUseCase,
    RemovePermissionFromRoleUseCase,
    UpdateRoleUseCase,
)
from app.application.use_cases.role import (
    AssignPermissionRequest,
    CreateRoleRequest,
    DeleteRoleRequest,
    GetAllRolesRequest,
    GetRoleByIdRequest,
    RemovePermissionRequest,
    UpdateRoleRequest,
)
from app.infra.utils.auth.permission import Permission
from app.interface.dependencies.auth_dependencies import get_authorized_user
from app.interface.dependencies.role_dependencies import (
    get_assign_permission_to_role_usecase,
    get_create_role_usecase,
    get_delete_role_usecase,
    get_get_all_roles_usecase,
    get_get_role_by_id_usecase,
    get_remove_permission_from_role_usecase,
    get_update_role_usecase,
)
from app.interface.dto import Role, RoleCreate, RoleUpdate
from app.interface.dto.responses import StandardResponse, success

# Create router with prefix and tags
role_router = APIRouter(prefix="/roles", tags=["roles"])


@role_router.get("/", response_model=StandardResponse[Page[Role]])
async def get_roles(
    params: Params = Depends(),
    usecase: GetAllRolesUseCase = Depends(get_get_all_roles_usecase),
    _=Depends(get_authorized_user([Permission.Roles_Read])),
):
    """Get a list of all roles"""
    result = await usecase.execute(
        GetAllRolesRequest(page=params.page, size=params.size)
    )
    from app.interface.mappers import RoleMapper

    roles_dto = [RoleMapper.to_dto(role) for role in result.roles]
    pages = (result.total + result.size - 1) // result.size if result.total else 1
    return success(
        message="Roles retrieved successfully",
        payload=Page(
            items=roles_dto,
            total=result.total,
            page=result.page,
            size=result.size,
            pages=pages,
        ),
    )


@role_router.get("/{role_id}", response_model=StandardResponse[Role])
async def get_role_by_id(
    role_id: str,
    usecase: GetRoleByIdUseCase = Depends(get_get_role_by_id_usecase),
    _=Depends(get_authorized_user([Permission.Roles_Read])),
):
    """Get a specific role by ID"""
    result = await usecase.execute(GetRoleByIdRequest(role_id=role_id))
    from app.interface.mappers import RoleMapper

    role_dto = RoleMapper.to_dto(result.role)
    return success(message="Role retrieved successfully", payload=role_dto)


@role_router.post("/", response_model=StandardResponse[Role])
async def create_role(
    role_create: RoleCreate,
    usecase: CreateRoleUseCase = Depends(get_create_role_usecase),
    _=Depends(get_authorized_user([Permission.Roles_Create])),
):
    """Create a new role"""
    result = await usecase.execute(
        CreateRoleRequest(
            name=role_create.name,
            permission_ids=role_create.permission_ids or [],
        )
    )
    from app.interface.mappers import RoleMapper

    role_dto = RoleMapper.to_dto(result.role)
    return success(message="Role created successfully", payload=role_dto)


@role_router.put("/{role_id}", response_model=StandardResponse[Role])
async def update_role(
    role_id: str,
    role_update: RoleUpdate,
    usecase: UpdateRoleUseCase = Depends(get_update_role_usecase),
    _=Depends(get_authorized_user([Permission.Roles_Update])),
):
    """Update a specific role by ID"""
    result = await usecase.execute(
        UpdateRoleRequest(
            role_id=role_id,
            name=role_update.name,
            is_active=role_update.is_active,
            permission_ids=role_update.permission_ids,
        )
    )
    from app.interface.mappers import RoleMapper

    role_dto = RoleMapper.to_dto(result.role)
    return success(message="Role updated successfully", payload=role_dto)


@role_router.delete("/{role_id}", response_model=StandardResponse[Role])
async def delete_role(
    role_id: str,
    usecase: DeleteRoleUseCase = Depends(get_delete_role_usecase),
    _=Depends(get_authorized_user([Permission.Roles_Delete])),
):
    """Delete a specific role by ID"""
    result = await usecase.execute(DeleteRoleRequest(role_id=role_id))
    from app.interface.mappers import RoleMapper

    role_dto = RoleMapper.to_dto(result.role)
    return success(message="Role deleted successfully", payload=role_dto)


@role_router.post(
    "/{role_id}/permissions/{permission_id}", response_model=StandardResponse[Role]
)
async def assign_permission_to_role(
    role_id: str,
    permission_id: str,
    usecase: AssignPermissionToRoleUseCase = Depends(
        get_assign_permission_to_role_usecase
    ),
    _=Depends(get_authorized_user([Permission.Roles_AssignPermission])),
):
    """Assign a permission to a role"""
    result = await usecase.execute(
        AssignPermissionRequest(role_id=role_id, permission_id=permission_id)
    )
    from app.interface.mappers import RoleMapper

    role_dto = RoleMapper.to_dto(result.role)
    return success(message="Permission assigned to role successfully", payload=role_dto)


@role_router.delete(
    "/{role_id}/permissions/{permission_id}", response_model=StandardResponse[Role]
)
async def remove_permission_from_role(
    role_id: str,
    permission_id: str,
    usecase: RemovePermissionFromRoleUseCase = Depends(
        get_remove_permission_from_role_usecase
    ),
    _=Depends(get_authorized_user([Permission.Roles_UnassignPermission])),
):
    """Remove a permission from a role"""
    result = await usecase.execute(
        RemovePermissionRequest(role_id=role_id, permission_id=permission_id)
    )
    from app.interface.mappers import RoleMapper

    role_dto = RoleMapper.to_dto(result.role)
    return success(
        message="Permission removed from role successfully", payload=role_dto
    )
