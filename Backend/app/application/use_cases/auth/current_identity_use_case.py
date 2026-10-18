from dataclasses import dataclass, field, replace
from typing import Literal

from app.domain.entities import UserEntity
from app.domain.error.exceptions import CredentialsValidationException, InactiveUserException
from app.interface.repository.role_repository_interface import IRoleRepository
from app.interface.repository.user_repository_interface import IUserRepository

EffectiveRole = Literal["Admin", "User"]


@dataclass(frozen=True)
class CurrentIdentity:
    user: UserEntity = field(repr=False)
    effective_role: EffectiveRole | None


class GetCurrentIdentityUseCase:
    def __init__(self, users: IUserRepository, roles: IRoleRepository) -> None:
        self._users = users
        self._roles = roles

    async def execute(self, user_id: str) -> CurrentIdentity:
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise CredentialsValidationException()
        if not user.is_active:
            raise InactiveUserException()
        roles = []
        for assignment in user.roles or []:
            role = await self._roles.get_by_id(assignment.id)
            if role is not None:
                roles.append(role)
        active_names = {role.name for role in roles if role.is_active}
        effective: EffectiveRole | None = (
            "Admin" if "Admin" in active_names else "User" if "User" in active_names else None
        )
        return CurrentIdentity(replace(user, roles=roles), effective)
