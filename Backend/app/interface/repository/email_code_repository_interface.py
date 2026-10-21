from app.application.use_cases.auth.email_codes import CodeReservation


class IEmailCodeRepository:
    """Each operation commits independently of a caller's HTTP/account transaction."""
    async def reserve(self, scope: bytes, digest: bytes, generation: str) -> CodeReservation:
        raise NotImplementedError

    async def activate(self, scope: bytes, generation: str) -> bool:
        raise NotImplementedError

    async def consume(self, scope: bytes, digest: bytes) -> bool:
        raise NotImplementedError
