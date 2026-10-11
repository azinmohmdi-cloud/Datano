from app.infra.repositories.in_memory.refresh_token_repository import (
    InMemoryRefreshTokenRepository,
)
from app.infra.repositories.in_memory.role_repository import InMemoryRoleRepository
from app.infra.repositories.in_memory.user_repository import InMemoryUserRepository
from app.infra.repositories.json.permission_repository import (
    JSONPermissionRepository,
)

user_repository = InMemoryUserRepository()
role_repository = InMemoryRoleRepository()
permission_repository = JSONPermissionRepository()
refresh_token_repository = InMemoryRefreshTokenRepository()


def reset():
    user_repository._users.clear()
    user_repository._user_role_ids.clear()
    role_repository._roles.clear()
    refresh_token_repository._tokens.clear()


__all__ = [
    "user_repository",
    "role_repository",
    "permission_repository",
    "refresh_token_repository",
    "reset",
]
