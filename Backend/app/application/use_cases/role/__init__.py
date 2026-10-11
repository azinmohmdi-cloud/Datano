"""
Role Use Cases module - Clean Architecture implementation.
"""

from .assign_permission_use_case import (
    AssignPermissionRequest,
    AssignPermissionResponse,
    AssignPermissionToRoleUseCase,
)
from .create_use_case import CreateRoleRequest, CreateRoleResponse, CreateRoleUseCase
from .delete_use_case import DeleteRoleRequest, DeleteRoleResponse, DeleteRoleUseCase
from .get_all_use_case import GetAllRolesRequest, GetAllRolesResponse, GetAllRolesUseCase
from .get_by_id_use_case import GetRoleByIdRequest, GetRoleByIdResponse, GetRoleByIdUseCase
from .remove_permission_use_case import (
    RemovePermissionRequest,
    RemovePermissionResponse,
    RemovePermissionFromRoleUseCase,
)
from .update_use_case import UpdateRoleRequest, UpdateRoleResponse, UpdateRoleUseCase

__all__ = [
    "GetAllRolesUseCase",
    "GetAllRolesRequest",
    "GetAllRolesResponse",
    "GetRoleByIdUseCase",
    "GetRoleByIdRequest",
    "GetRoleByIdResponse",
    "CreateRoleUseCase",
    "CreateRoleRequest",
    "CreateRoleResponse",
    "UpdateRoleUseCase",
    "UpdateRoleRequest",
    "UpdateRoleResponse",
    "DeleteRoleUseCase",
    "DeleteRoleRequest",
    "DeleteRoleResponse",
    "AssignPermissionToRoleUseCase",
    "AssignPermissionRequest",
    "AssignPermissionResponse",
    "RemovePermissionFromRoleUseCase",
    "RemovePermissionRequest",
    "RemovePermissionResponse",
]
