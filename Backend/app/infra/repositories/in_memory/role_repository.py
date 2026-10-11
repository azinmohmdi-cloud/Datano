from typing import Optional

from fastapi_pagination import Page, Params

from app.domain.entities import RoleEntity
from app.interface.repository.role_repository_interface import IRoleRepository


class InMemoryRoleRepository(IRoleRepository):
    def __init__(self):
        self._roles: dict[str, RoleEntity] = {}

    async def get_all(self, params: Params) -> Page[RoleEntity]:
        values = list(self._roles.values())
        total = len(values)
        start = (params.page - 1) * params.size
        end = start + params.size
        items = values[start:end]
        return Page(
            items=items,
            total=total,
            page=params.page,
            size=params.size,
            pages=(total + params.size - 1) // params.size if total else 1,
        )

    async def get_by_id(self, role_id: str) -> Optional[RoleEntity]:
        return self._roles.get(role_id)

    async def get_by_name(self, name: str) -> Optional[RoleEntity]:
        for role in self._roles.values():
            if role.name == name:
                return role
        return None

    async def create(self, created_domain: RoleEntity) -> RoleEntity:
        self._roles[created_domain.id] = created_domain
        return created_domain

    async def update(self, updated_domain: RoleEntity) -> Optional[RoleEntity]:
        if updated_domain.id not in self._roles:
            return None
        self._roles[updated_domain.id] = updated_domain
        return updated_domain

    async def delete(self, role_id: str) -> Optional[RoleEntity]:
        return self._roles.pop(role_id, None)
