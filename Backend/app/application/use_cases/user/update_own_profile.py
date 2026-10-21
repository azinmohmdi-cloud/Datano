"""Names-only self editing; authenticated identity is supplied by the server."""
from dataclasses import dataclass, replace

from app.domain.entities import UserEntity
from app.domain.error.exceptions import CredentialsValidationException
from app.interface.repository.user_repository_interface import IUserRepository


@dataclass(frozen=True)
class UpdateOwnProfileRequest:
    first_name: str | None = None
    last_name: str | None = None


class UpdateOwnProfileUseCase:
    def __init__(self, users: IUserRepository) -> None:
        self._users = users

    async def execute(self, user_id: str, request: UpdateOwnProfileRequest) -> UserEntity:
        user = await self._users.get_by_id(user_id)
        if user is None or not user.is_active:
            raise CredentialsValidationException()
        # Memory adapters may return shared objects. Rejected validation or a
        # failed write must not partially change names or timestamps in them.
        candidate = replace(user)
        candidate.update_profile_names(first_name=request.first_name, last_name=request.last_name)
        updated = await self._users.update_profile_names(user_id, first_name=request.first_name,
            last_name=request.last_name, updated_at=candidate.updated_at)
        if updated is None:
            raise CredentialsValidationException()
        return updated
