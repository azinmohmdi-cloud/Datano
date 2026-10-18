from app.application.use_cases.auth.session_models import IssuedSession, SessionPolicy, SessionRecord
from app.application.use_cases.auth.interfaces import ISessionTokens
from app.interface.repository.session_repository_interface import ISessionRepository


class SessionService:
    def __init__(self, repository: ISessionRepository, tokens: ISessionTokens, policy: SessionPolicy | None = None) -> None:
        self._repository = repository
        self._tokens = tokens
        self._policy = policy if policy is not None else SessionPolicy()

    async def issue(self, user_id: str, *, remember_me: bool = False,
                    previous_token: str | None = None) -> IssuedSession:
        token = self._tokens.generate()
        digest = self._tokens.digest(token)
        if digest is None:
            raise ValueError("Session token generator returned an invalid identifier")
        idle, absolute = self._policy.timeouts(remember_me)
        previous_digest = self._tokens.digest(previous_token) if previous_token is not None else None
        if previous_digest is None:
            record = await self._repository.create(digest, user_id, remember_me=remember_me,
                idle_seconds=idle, absolute_seconds=absolute)
        else:
            record = await self._repository.rotate(previous_digest, digest, user_id,
                remember_me=remember_me, idle_seconds=idle, absolute_seconds=absolute)
        return IssuedSession(token, record)

    async def resolve(self, token: str, *, touch: bool = True) -> SessionRecord | None:
        digest = self._tokens.digest(token)
        return None if digest is None else await self._repository.resolve(digest, touch=touch)

    async def revoke(self, token: str) -> bool:
        digest = self._tokens.digest(token)
        return False if digest is None else await self._repository.revoke(digest)

    async def revoke_all(self, user_id: str) -> int:
        return await self._repository.revoke_all(user_id)
