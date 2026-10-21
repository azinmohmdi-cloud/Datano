from datetime import datetime

from app.application.use_cases.auth.password_recovery import RecoveryAccount


class IRecoveryRepository:
    async def account(self, email: str) -> RecoveryAccount | None:
        raise NotImplementedError

    async def grant(self, account: RecoveryAccount, digest: bytes, *, seconds: int) -> datetime | None:
        raise NotImplementedError

    async def valid(self, digest: bytes) -> bool:
        raise NotImplementedError

    async def reset(self, digest: bytes, password_hash: str) -> bool:
        raise NotImplementedError
