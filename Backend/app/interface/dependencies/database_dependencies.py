from collections.abc import AsyncIterator

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession


async def get_database_session(request: Request) -> AsyncIterator[AsyncSession]:
    """One transaction for every repository participating in this HTTP operation."""
    async with request.app.state.database.transaction() as session:
        yield session
