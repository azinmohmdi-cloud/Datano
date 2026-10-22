from datetime import datetime

from fastapi import Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.website import CreateWebsiteUseCase, GetOwnWebsitesUseCase, GetOwnWebsiteUseCase
from app.infra.repositories.postgres.website_repository import SQLWebsiteRepository
from app.interface.dependencies.database_dependencies import get_database_session
from app.interface.repository.website_repository_interface import IWebsiteRepository
from app.application.use_cases.website.html import IWebsiteHTMLFetcher
from app.infra.services.website_html_fetcher import HTMLFetchLimits, SafeWebsiteHTMLFetcher
from app.application.use_cases.website.proof import IssueWebsiteChallengeUseCase, VerifyWebsiteChallengeUseCase, IWebsiteProofRepository
from app.infra.repositories.postgres.website_proof_repository import SQLWebsiteProofRepository
from app.infra.services.website_challenge_tokens import WebsiteChallengeTokens
from app.infra.services.website_meta_parser import WebsiteMetaParser


async def get_website_repository(session: AsyncSession = Depends(get_database_session)) -> IWebsiteRepository:
    return SQLWebsiteRepository(session)


def get_website_html_fetcher(request: Request) -> IWebsiteHTMLFetcher:
    settings = request.app.state.settings
    return SafeWebsiteHTMLFetcher(limits=HTMLFetchLimits(total_seconds=settings.html_fetch_total_seconds,
        dns_seconds=settings.html_fetch_dns_seconds, connect_seconds=settings.html_fetch_connect_seconds,
        read_seconds=settings.html_fetch_read_seconds, max_bytes=settings.html_fetch_max_bytes))


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


def get_website_proof_repository(request: Request) -> IWebsiteProofRepository:
    # Independent short transactions, so no account/session lock spans HTML I/O.
    return SQLWebsiteProofRepository(request.app.state.database)


def get_issue_website_challenge_usecase(repository: IWebsiteProofRepository = Depends(get_website_proof_repository)) -> IssueWebsiteChallengeUseCase:
    return IssueWebsiteChallengeUseCase(repository, WebsiteChallengeTokens())


def get_verify_website_challenge_usecase(repository: IWebsiteProofRepository = Depends(get_website_proof_repository),
    fetcher: IWebsiteHTMLFetcher = Depends(get_website_html_fetcher)) -> VerifyWebsiteChallengeUseCase:
    return VerifyWebsiteChallengeUseCase(repository, WebsiteChallengeTokens(), fetcher, WebsiteMetaParser())
