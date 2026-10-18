"""Read an opaque session in a fresh process without disclosing its identifier."""
import asyncio
import json
import sys
from datetime import datetime

from app.application.use_cases.auth.session_service import SessionService
from app.infra.database.connection import Database
from app.infra.repositories.postgres.session_repository import SQLSessionRepository
from app.infra.services.session_token_service import OpaqueSessionTokens


async def main():
    payload=json.load(sys.stdin)
    database=Database(payload["url"])
    try:
        async with database.transaction() as session:
            service=SessionService(SQLSessionRepository(session,clock=lambda:datetime.fromisoformat(payload["now"])),OpaqueSessionTokens())
            record=await service.resolve(payload["token"],touch=False)
            print(json.dumps({"valid":record is not None,"user_id":record.user_id if record else None}))
    finally:
        await database.dispose()


if __name__ == "__main__":
    asyncio.run(main())
