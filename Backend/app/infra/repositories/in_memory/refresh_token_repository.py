from typing import Optional

from app.domain.entities import RefreshTokenEntity
from app.interface.repository.refresh_token_repository_interface import (
    IRefreshTokenRepository,
)


class InMemoryRefreshTokenRepository(IRefreshTokenRepository):
    def __init__(self):
        self._tokens: dict[str, RefreshTokenEntity] = {}

    async def create_refresh_token(
        self, refresh_token_to_create: RefreshTokenEntity
    ) -> RefreshTokenEntity:
        self._tokens[refresh_token_to_create.id] = refresh_token_to_create
        return refresh_token_to_create

    async def get_refresh_token_by_token(
        self, token: str
    ) -> Optional[RefreshTokenEntity]:
        for t in self._tokens.values():
            if t.token == token:
                return t
        return None

    async def revoke_refresh_token(self, token_id: str) -> bool:
        token = self._tokens.get(token_id)
        if token:
            token.revoke()
            return True
        return False
