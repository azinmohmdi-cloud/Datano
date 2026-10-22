from datetime import datetime

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.website import CreateWebsiteUseCase, GetOwnWebsitesUseCase, GetOwnWebsiteUseCase
from app.infra.repositories.postgres.website_repository import SQLWebsiteRepository
from app.interface.dependencies.database_dependencies import get_database_session
from app.interface.repository.website_repository_interface import IWebsiteRepository


async def get_website_repository(session: AsyncSession = Depends(get_database_session)) -> IWebsiteRepository:
    return SQLWebsiteRepository(session)


async def get_create_website_usecase(
    websites: IWebsiteRepository = Depends(get_website_repository),
    session: AsyncSession = Depends(get_database_session),
) -> CreateWebsiteUseCase:
    # Use the same clock as claim expiry checks, independent of application/DB
    # host skew. No submitted field can choose the reservation's creation time.
    instant: datetime = (await session.execute(select(func.clock_timestamp()))).scalar_one()
    return CreateWebsiteUseCase(websites, clock=lambda: instant)


def get_get_own_websites_usecase(websites: IWebsiteRepository = Depends(get_website_repository)) -> GetOwnWebsitesUseCase:
    return GetOwnWebsitesUseCase(websites)


def get_get_own_website_usecase(websites: IWebsiteRepository = Depends(get_website_repository)) -> GetOwnWebsiteUseCase:
    return GetOwnWebsiteUseCase(websites)
