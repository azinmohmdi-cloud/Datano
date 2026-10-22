"""Durable, owner/session-scoped proof transitions; no transaction crosses HTML I/O."""
import asyncio
from dataclasses import asdict, replace
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, update

from app.application.use_cases.website.html import IWebsiteHTMLFetcher, WebsiteHTML
from app.application.use_cases.website.proof import IssueWebsiteChallengeUseCase, VerifyWebsiteChallengeUseCase
from app.domain.entities import UserEntity, WebsiteEntity
from app.domain.error.exceptions import CredentialsValidationException, ResourceNotFoundException, WebsiteChallengeException
from app.infra.database.connection import Database
from app.infra.database.models import UserRow, WebsiteRow
from app.infra.repositories.postgres.session_repository import SQLSessionRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.infra.repositories.postgres.website_repository import SQLWebsiteRepository
from app.infra.repositories.postgres.website_proof_repository import SQLWebsiteProofRepository
from app.infra.services.website_challenge_tokens import WebsiteChallengeTokens
from app.infra.services.website_meta_parser import WebsiteMetaParser
from tests.postgres import isolated_postgres_url, persistent_database


@pytest.fixture
async def state(persistent_database):
    now = datetime.now(UTC) - timedelta(seconds=2)
    users = [UserEntity.create(first_name="Proof", last_name="Owner", email=f"proof{index}@example.test", username=f"proof-owner-{index}", hashed_password="test-only-hash") for index in range(2)]
    site = WebsiteEntity.create(users[0].id, "example.test", now=now)
    async with persistent_database.transaction() as session:
        for index, user in enumerate(users):
            user.activate(); await SQLUserRepository(session).create(user)
            await SQLSessionRepository(session).create(bytes([index + 1])*32, user.id, remember_me=True, idle_seconds=259200, absolute_seconds=259200)
        await SQLWebsiteRepository(session).claim(site)
    return users, site


async def stored(database, site):
    async with database.transaction() as session:
        return await SQLWebsiteRepository(session).get_by_id(site.id, site.owner_id)


class HTML(IWebsiteHTMLFetcher):
    def __init__(self, token): self.token, self.calls = token, []
    async def fetch(self, address):
        self.calls.append(address)
        return WebsiteHTML(address.url, "text/html", f'<html><head><meta name="datano-verification" content="{self.token}"></head></html>'.encode())


def verify(repository, html):
    return VerifyWebsiteChallengeUseCase(repository, WebsiteChallengeTokens(), html, WebsiteMetaParser())


async def test_real_issue_verify_and_restart_store_only_digest(persistent_database, isolated_postgres_url, state):
    _, site = state; repo = SQLWebsiteProofRepository(persistent_database)
    issued = await IssueWebsiteChallengeUseCase(repo, WebsiteChallengeTokens()).execute(b"\x01"*32, site.id)
    assert issued.website.challenge_expires_at - issued.website.challenge_issued_at == timedelta(hours=24)
    row = await stored(persistent_database, site)
    assert row.challenge_digest == WebsiteChallengeTokens().digest(row, issued.token) and row.verified_at is None
    async with persistent_database.transaction() as session:
        assert issued.token.encode() not in bytes((await session.scalar(select(WebsiteRow.challenge_digest).where(WebsiteRow.id == site.id))))
    html = HTML(issued.token); result = await verify(repo, html).execute(b"\x01"*32, site.id)
    assert result.verified_at is not None and result.challenge_status(result.updated_at) == "verified"
    assert await verify(repo, html).execute(b"\x01"*32, site.id) == result and len(html.calls) == 1
    reopened = Database(isolated_postgres_url)
    try: assert await stored(reopened, site) == result
    finally: await reopened.dispose()
    with pytest.raises(WebsiteChallengeException): await IssueWebsiteChallengeUseCase(repo, WebsiteChallengeTokens()).execute(b"\x01"*32, site.id)


async def test_old_token_rotation_and_cross_site_replay_do_not_grant(persistent_database, state):
    _, site = state; repo = SQLWebsiteProofRepository(persistent_database); issue = IssueWebsiteChallengeUseCase(repo, WebsiteChallengeTokens())
    first = await issue.execute(b"\x01"*32, site.id); second = await issue.execute(b"\x01"*32, site.id)
    assert first.token != second.token
    for token in [first.token, "x"*43]:
        with pytest.raises(WebsiteChallengeException): await verify(repo, HTML(token)).execute(b"\x01"*32, site.id)
    assert (await stored(persistent_database, site)).verified_at is None
    async with persistent_database.transaction() as session:
        sibling = await SQLWebsiteRepository(session).claim(WebsiteEntity.create(site.owner_id, "www.example.test", now=site.created_at))
    await issue.execute(b"\x01"*32, sibling.id)
    with pytest.raises(WebsiteChallengeException): await verify(repo, HTML(second.token)).execute(b"\x01"*32, sibling.id)
    assert (await stored(persistent_database, sibling)).verified_at is None


async def test_foreign_missing_and_released_are_same_404_without_fetch(persistent_database, state):
    _, site = state; repo = SQLWebsiteProofRepository(persistent_database); html = HTML("x"*43)
    for digest, identifier in [(b"\x02"*32, site.id), (b"\x01"*32, "missing")]:
        with pytest.raises(ResourceNotFoundException, match="requested record"):
            await verify(repo, html).execute(digest, identifier)
    assert not html.calls


@pytest.mark.parametrize("phase", ["before_fetch", "during_fetch"])
async def test_exact_24_hour_expiry_cannot_verify_even_with_correct_html(persistent_database, state, phase):
    _, site = state; current = datetime.now(UTC) + timedelta(seconds=1)
    repo = SQLWebsiteProofRepository(persistent_database, clock=lambda: current)
    issued = await IssueWebsiteChallengeUseCase(repo, WebsiteChallengeTokens()).execute(b"\x01"*32, site.id)
    class Expiring(HTML):
        async def fetch(self, address):
            nonlocal current
            current = issued.website.challenge_expires_at
            return await super().fetch(address)
    html = Expiring(issued.token)
    if phase == "before_fetch": current = issued.website.challenge_expires_at
    with pytest.raises(WebsiteChallengeException): await verify(repo, html).execute(b"\x01"*32, site.id)
    assert (await stored(persistent_database, site)).verified_at is None
    assert bool(html.calls) == (phase == "during_fetch")


@pytest.mark.parametrize("change", ["rotate", "logout", "deactivate", "replace", "session_expiry"])
async def test_late_html_cannot_confirm_changed_challenge_owner_or_session(persistent_database, state, change):
    users, site = state
    current = datetime.now(UTC) + timedelta(seconds=1)
    repo = SQLWebsiteProofRepository(persistent_database, clock=lambda: current)
    issue = IssueWebsiteChallengeUseCase(repo, WebsiteChallengeTokens())
    issued = await issue.execute(b"\x01"*32, site.id)
    started, release = asyncio.Event(), asyncio.Event()
    class Paused(HTML):
        async def fetch(self, address):
            started.set(); await release.wait(); return await super().fetch(address)
    operation = asyncio.create_task(verify(repo, Paused(issued.token)).execute(b"\x01"*32, site.id))
    await asyncio.wait_for(started.wait(), 2)
    # A separate transaction must complete while the remote fetch is suspended.
    async def mutate():
        nonlocal current
        if change == "rotate":
            current += timedelta(seconds=1); await issue.execute(b"\x01"*32, site.id)
        elif change == "session_expiry": current += timedelta(days=4)
        else:
            async with persistent_database.transaction() as session:
                if change == "logout": await SQLSessionRepository(session).revoke(b"\x01"*32)
                elif change == "deactivate": await session.execute(update(UserRow).where(UserRow.id == users[0].id).values(is_active=False))
                else:
                    # Deterministically expire the current reservation, preserving
                    # its 24-hour issued-state database invariants, then claim it.
                    delta = timedelta(days=2)
                    await session.execute(update(WebsiteRow).where(WebsiteRow.id == site.id).values(
                        created_at=WebsiteRow.created_at-delta, updated_at=WebsiteRow.updated_at-delta,
                        challenge_issued_at=WebsiteRow.challenge_issued_at-delta,
                        challenge_expires_at=WebsiteRow.challenge_expires_at-delta,
                        reservation_expires_at=WebsiteRow.reservation_expires_at-delta))
                    await SQLWebsiteRepository(session).claim(WebsiteEntity.create(users[1].id, site.hostname, now=datetime.now(UTC)-timedelta(seconds=1)))
    try: await asyncio.wait_for(mutate(), 3)
    finally: release.set()
    with pytest.raises((WebsiteChallengeException, CredentialsValidationException, ResourceNotFoundException)):
        await operation
    async with persistent_database.transaction() as session:
        assert await session.scalar(select(func.count()).select_from(WebsiteRow).where(WebsiteRow.verified_at.is_not(None))) == 0


async def test_competing_issue_cas_and_simultaneous_confirmations(persistent_database, state):
    _, site = state; repo = SQLWebsiteProofRepository(persistent_database); crypto = WebsiteChallengeTokens()
    snapshot = await repo.snapshot(b"\x01"*32, site.id)
    tokens = [crypto.generate(), crypto.generate()]
    results = await asyncio.gather(*(repo.issue(b"\x01"*32, snapshot.website, crypto.digest(site, token)) for token in tokens), return_exceptions=True)
    assert sum(isinstance(value, WebsiteEntity) for value in results) == 1
    assert sum(isinstance(value, WebsiteChallengeException) for value in results) == 1
    current = await stored(persistent_database, site)
    verified = await asyncio.gather(repo.confirm(b"\x01"*32, current), repo.confirm(b"\x01"*32, current))
    assert verified[0] == verified[1] and verified[0].verified_at is not None


async def test_snapshot_cannot_be_applied_with_another_owners_session(persistent_database, state):
    _, site = state; repo = SQLWebsiteProofRepository(persistent_database)
    snapshot = await repo.snapshot(b"\x01"*32, site.id)
    with pytest.raises(ResourceNotFoundException): await repo.issue(b"\x02"*32, snapshot.website, b"d"*32)
    with pytest.raises(ResourceNotFoundException): await repo.confirm(b"\x02"*32, snapshot.website)
    assert (await stored(persistent_database, site)).challenge_digest is None


async def test_storage_failure_is_safe_and_never_returns_a_challenge_or_proof():
    from contextlib import asynccontextmanager
    from sqlalchemy.exc import SQLAlchemyError
    from app.domain.error.exceptions import ServiceUnavailableException
    class BrokenDatabase:
        @asynccontextmanager
        async def transaction(self):
            raise SQLAlchemyError("private-dsn-and-proof")
            yield
    with pytest.raises(ServiceUnavailableException) as caught:
        await SQLWebsiteProofRepository(BrokenDatabase()).snapshot(b"s"*32, "site")
    assert caught.value.__context__ is None and "private-dsn-and-proof" not in str(caught.value)
