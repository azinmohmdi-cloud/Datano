from datetime import UTC, datetime
from typing import List, Optional

from fastapi_pagination import Page, Params

from app.domain.entities import RoleEntity, UserEntity
from app.domain.error.exceptions import ConflictException, ResourceNotFoundException
from app.interface.repository.user_repository_interface import IUserRepository


class InMemoryUserRepository(IUserRepository):
    def __init__(self):
        self._users: dict[str, UserEntity] = {}
        self._user_role_ids: dict[str, List[str]] = {}

    async def create(self, user_to_create: UserEntity) -> UserEntity:
        self._users[user_to_create.id] = user_to_create
        self._user_role_ids[user_to_create.id] = []
        user_to_create.roles = []
        return user_to_create

    async def get_by_id(self, user_id: str) -> Optional[UserEntity]:
        user = self._users.get(user_id)
        if user is None:
            return None
        user.roles = self._build_role_entities(user_id)
        return user

    async def get_all(self, params: Params) -> Page[UserEntity]:
        values = list(self._users.values())
        for user in values:
            user.roles = self._build_role_entities(user.id)
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

    async def update(self, source: UserEntity) -> Optional[UserEntity]:
        if source.id not in self._users:
            return None
        self._users[source.id] = source
        source.roles = self._build_role_entities(source.id)
        return source

    async def delete(self, user_id: str) -> Optional[UserEntity]:
        user = self._users.pop(user_id, None)
        if user is None:
            return None
        self._user_role_ids.pop(user_id, None)
        user.roles = []
        return user

    async def get_by_email(self, email: str) -> Optional[UserEntity]:
        for user in self._users.values():
            if user.email == email:
                user.roles = self._build_role_entities(user.id)
                return user
        return None

    async def get_by_username(self, username: str) -> Optional[UserEntity]:
        for user in self._users.values():
            if user.username == username:
                user.roles = self._build_role_entities(user.id)
                return user
        return None

    async def assign_role(self, user_id: str, role_id: str) -> UserEntity:
        user = self._users.get(user_id)
        if not user:
            raise ResourceNotFoundException(resource_type="User", identifier=user_id)
        role_ids = self._user_role_ids.setdefault(user_id, [])
        if role_id in role_ids:
            raise ConflictException("User already has this role")
        role_ids.append(role_id)
        user.roles = self._build_role_entities(user_id)
        return user

    async def remove_role(self, user_id: str, role_id: str) -> UserEntity:
        user = self._users.get(user_id)
        if not user:
            raise ResourceNotFoundException(resource_type="User", identifier=user_id)
        role_ids = self._user_role_ids.get(user_id, [])
        self._user_role_ids[user_id] = [rid for rid in role_ids if rid != role_id]
        user.roles = self._build_role_entities(user_id)
        return user

    def _build_role_entities(self, user_id: str) -> List[RoleEntity]:
        role_ids = self._user_role_ids.get(user_id, [])
        now = datetime.now(UTC)
        return [
            RoleEntity(
                id=rid,
                name="",
                created_at=now,
                updated_at=now,
                is_active=True,
                permission_ids=[],
            )
            for rid in role_ids
        ]
