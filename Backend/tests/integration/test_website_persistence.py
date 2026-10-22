import asyncio
from dataclasses import asdict, replace
from datetime import UTC, datetime, timedelta

import pytest
from fastapi_pagination import Params
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import IntegrityError

from app.domain.entities import UserEntity, WebsiteEntity
from app.domain.error.exceptions import ConflictException, ResourceNotFoundException, ValidationException
from app.infra.database.connection import Database
from app.infra.database.models import WebsiteRow
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.infra.repositories.postgres.website_repository import SQLWebsiteRepository
from app.interface.repository.website_repository_interface import IWebsiteRepository

from tests.postgres import isolated_postgres_url, persistent_database


@pytest.fixture
async def owners(persistent_database):
    users = [UserEntity.create(first_name="نام", last_name="آزمون", email=f"owner{i}@example.test",
             username=f"owner{i}", hashed_password="test-only-hash") for i in range(2)]
    async with persistent_database.transaction() as session:
        for user in users:
            await SQLUserRepository(session).create(user)
    return users


def proof_state(site, *, verified=False):
    instant = site.created_at + timedelta(microseconds=1)
    return replace(site, challenge_digest=b"d" * 32, challenge_issued_at=instant,
                   challenge_expires_at=instant + timedelta(hours=24),
                   reservation_expires_at=instant + timedelta(hours=24), updated_at=instant,
                   verified_at=instant if verified else None)


async def insert_raw(database, site):
    async with database.transaction() as session:
        session.add(WebsiteRow(**asdict(site)))


async def test_website_storage_is_available_after_migration(persistent_database):
    async with persistent_database.engine.begin() as connection:
        tables = await connection.run_sync(lambda sync: inspect(sync).get_table_names())
        assert "websites" in tables
        columns = await connection.run_sync(lambda sync: inspect(sync).get_columns("websites"))
        assert {column["name"] for column in columns} == {
            "id", "owner_id", "hostname", "scheme", "created_at", "updated_at",
            "reservation_expires_at", "challenge_digest", "challenge_issued_at",
            "challenge_expires_at", "verified_at", "released_at",
        }


async def test_canonical_websites_and_challenges_survive_pool_restart(persistent_database, isolated_postgres_url, owners):
    source = WebsiteEntity.create(owners[0].id, "BÜCHER.de.", scheme="http")
    async with persistent_database.transaction() as session:
        repo = SQLWebsiteRepository(session)
        assert isinstance(repo, IWebsiteRepository)
        assert await repo.claim(source) == source
        pending = proof_state(source)
        assert await repo.save_verification(pending, expected_updated_at=source.updated_at) == pending
    await persistent_database.dispose()
    reopened = Database(isolated_postgres_url)
    try:
        async with reopened.transaction() as session:
            repo = SQLWebsiteRepository(session)
            stored = await repo.get_by_id(source.id, owners[0].id)
            assert stored == pending
            assert stored.hostname == "xn--bcher-kva.de" and stored.scheme == "http"
            assert stored.challenge_status(stored.updated_at) == "pending"
            assert await repo.get_by_id(source.id, owners[1].id) is None
            assert await repo.get_by_id("missing", owners[0].id) is None
            assert (await repo.get_by_owner(owners[1].id, Params())).items == []
    finally:
        await reopened.dispose()


async def test_same_owner_reuses_identity_without_refreshing_scheme_or_reservation(persistent_database, owners):
    first = WebsiteEntity.create(owners[0].id, "Example.COM")
    async with persistent_database.transaction() as session:
        repo = SQLWebsiteRepository(session)
        assert await repo.claim(first) == first
    async with persistent_database.transaction() as session:
        reused = await SQLWebsiteRepository(session).claim(WebsiteEntity.create(owners[0].id, "example.com.", scheme="http"))
        assert reused == first
        assert await session.scalar(select(func.count()).select_from(WebsiteRow)) == 1


@pytest.mark.parametrize("verified", [False, True])
async def test_other_owner_cannot_replace_live_or_verified_claim(persistent_database, owners, verified):
    created = datetime.now(UTC) - (timedelta(days=10) if verified else timedelta())
    original = WebsiteEntity.create(owners[0].id, "example.com", now=created)
    if verified:
        original = proof_state(original, verified=True)
    await insert_raw(persistent_database, original)
    with pytest.raises(ConflictException) as error:
        async with persistent_database.transaction() as session:
            await SQLWebsiteRepository(session).claim(WebsiteEntity.create(owners[1].id, "EXAMPLE.COM."))
    assert str(error.value) == "Website is unavailable"
    assert error.value.details == {}
    async with persistent_database.transaction() as session:
        assert await SQLWebsiteRepository(session).get_by_id(original.id, owners[0].id) == original


@pytest.mark.parametrize("age", [timedelta(hours=24), timedelta(hours=25)])
async def test_expired_reservation_replacement_has_new_identity_and_no_inherited_proof(persistent_database, owners, age):
    original = WebsiteEntity.create(owners[0].id, "example.com", now=datetime.now(UTC) - age)
    await insert_raw(persistent_database, original)
    replacement = WebsiteEntity.create(owners[1].id, "example.com")
    async with persistent_database.transaction() as session:
        assert await SQLWebsiteRepository(session).claim(replacement) == replacement
    async with persistent_database.transaction() as session:
        repo = SQLWebsiteRepository(session)
        assert await repo.get_by_id(original.id, owners[0].id) is None
        assert (await repo.get_by_owner(owners[0].id, Params())).total == 0
        assert await repo.get_by_id(replacement.id, owners[1].id) == replacement
        old_row = await session.get(WebsiteRow, original.id)
        assert old_row.owner_id == original.owner_id and old_row.released_at is not None
        assert replacement.challenge_digest is replacement.verified_at is None
        assert await session.scalar(select(func.count()).select_from(WebsiteRow)) == 2
    # A late proof for the superseded record cannot alter the new owner's claim.
    async with persistent_database.transaction() as session:
        assert await SQLWebsiteRepository(session).save_verification(
            proof_state(original, verified=True), expected_updated_at=original.updated_at) is None


async def test_same_owner_expired_registration_is_idempotent(persistent_database, owners):
    original = WebsiteEntity.create(owners[0].id, "example.com", now=datetime.now(UTC) - timedelta(days=2))
    await insert_raw(persistent_database, original)
    async with persistent_database.transaction() as session:
        assert await SQLWebsiteRepository(session).claim(WebsiteEntity.create(owners[0].id, "example.com")) == original


async def test_www_and_subdomains_have_independent_owners_and_multiple_sites_are_allowed(persistent_database, owners):
    sites = [WebsiteEntity.create(owners[i % 2].id, host) for i, host in enumerate(
        ["example.com", "www.example.com", "shop.example.com", "faß.de", "fass.de"])]
    async with persistent_database.transaction() as session:
        repo = SQLWebsiteRepository(session)
        for site in sites:
            assert await repo.claim(site) == site
    async with persistent_database.transaction() as session:
        assert (await SQLWebsiteRepository(session).get_by_owner(owners[0].id, Params())).total == 3
        assert (await SQLWebsiteRepository(session).get_by_owner(owners[1].id, Params())).total == 2


async def test_owner_pagination_is_bounded_stable_and_has_no_foreign_records(persistent_database, owners):
    now = datetime.now(UTC) - timedelta(seconds=5)
    sites = sorted([WebsiteEntity.create(owners[0].id, f"site{i}.example", now=now) for i in range(5)], key=lambda site: site.id)
    async with persistent_database.transaction() as session:
        repo = SQLWebsiteRepository(session)
        for site in sites + [WebsiteEntity.create(owners[1].id, "foreign.example", now=now)]:
            await repo.claim(site)
    async with persistent_database.transaction() as session:
        repo = SQLWebsiteRepository(session)
        first = await repo.get_by_owner(owners[0].id, Params(size=2))
        second = await repo.get_by_owner(owners[0].id, Params(page=2, size=2))
        assert first.items == sites[:2] and second.items == sites[2:4]
        assert first.total == second.total == 5 and first.pages == 3
        assert (await repo.get_by_owner(owners[0].id, Params(page=20, size=2))).items == []
        empty = await repo.get_by_owner("missing-owner", Params())
        assert empty.items == [] and empty.total == 0 and empty.pages == 1


@pytest.mark.parametrize("same_owner,expired", [(False, False), (True, False), (False, True)])
async def test_concurrent_registration_serializes_canonical_claims(persistent_database, owners, same_owner, expired):
    if expired:
        await insert_raw(persistent_database, WebsiteEntity.create(
            owners[0].id, "example.com", now=datetime.now(UTC) - timedelta(days=2)))
        # Both contenders must be new claimants, independent from the expired owner.
        third = UserEntity.create(first_name="Third", last_name="Owner", email="third@example.test",
                                  username="owner-third", hashed_password="test-only-hash")
        async with persistent_database.transaction() as session:
            await SQLUserRepository(session).create(third)
        contenders = [owners[1], third]
    else:
        contenders = [owners[0], owners[0] if same_owner else owners[1]]
    barrier = asyncio.Barrier(2)

    async def attempt(index):
        async with persistent_database.transaction() as session:
            repo = SQLWebsiteRepository(session)
            assert (await repo.get_by_owner(contenders[index].id, Params())).total == 0
            await barrier.wait()
            return await repo.claim(WebsiteEntity.create(contenders[index].id, ["EXAMPLE.COM.", "example.com"][index]))

    results = await asyncio.wait_for(asyncio.gather(attempt(0), attempt(1), return_exceptions=True), 15)
    if same_owner:
        assert all(isinstance(result, WebsiteEntity) for result in results)
        assert results[0].id == results[1].id
    else:
        assert sum(isinstance(result, WebsiteEntity) for result in results) == 1
        assert sum(isinstance(result, ConflictException) for result in results) == 1
    async with persistent_database.transaction() as session:
        assert await session.scalar(select(func.count()).select_from(WebsiteRow).where(WebsiteRow.released_at.is_(None))) == 1


async def test_raw_concurrent_inserts_are_protected_by_database_unique_index(persistent_database, owners):
    barrier = asyncio.Barrier(2)
    async def attempt(index):
        async with persistent_database.transaction() as session:
            await barrier.wait()
            session.add(WebsiteRow(**asdict(WebsiteEntity.create(owners[index].id, "example.com"))))
            await session.flush()
    results = await asyncio.wait_for(asyncio.gather(attempt(0), attempt(1), return_exceptions=True), 15)
    assert sum(result is None for result in results) == 1
    failures = [result for result in results if isinstance(result, IntegrityError)]
    assert len(failures) == 1 and failures[0].orig.sqlstate == "23505"


@pytest.mark.parametrize("existing_expired", [False, True])
async def test_failed_claim_rolls_back_new_row_and_reservation_release(persistent_database, owners, existing_expired):
    original = WebsiteEntity.create(owners[0].id, "example.com", now=datetime.now(UTC) - timedelta(days=2))
    if existing_expired:
        await insert_raw(persistent_database, original)
    candidate = WebsiteEntity.create(owners[1].id, "example.com")
    with pytest.raises(RuntimeError, match="abort"):
        async with persistent_database.transaction() as session:
            await SQLWebsiteRepository(session).claim(candidate)
            raise RuntimeError("abort")
    async with persistent_database.transaction() as session:
        repo = SQLWebsiteRepository(session)
        assert await repo.get_by_id(candidate.id, owners[1].id) is None
        assert await repo.get_by_id(original.id, owners[0].id) == (original if existing_expired else None)


async def test_missing_owner_is_safe_and_failed_replacement_restores_previous_record(persistent_database, owners):
    original = WebsiteEntity.create(owners[0].id, "example.com", now=datetime.now(UTC) - timedelta(days=2))
    await insert_raw(persistent_database, original)
    with pytest.raises(ResourceNotFoundException) as error:
        async with persistent_database.transaction() as session:
            await SQLWebsiteRepository(session).claim(WebsiteEntity.create("missing-owner", "example.com"))
    assert "SQL" not in str(error.value) and "missing-owner" not in str(error.value)
    async with persistent_database.transaction() as session:
        assert await SQLWebsiteRepository(session).get_by_id(original.id, owners[0].id) == original


@pytest.mark.parametrize("change", ["owner", "hostname", "scheme", "created", "stale"])
async def test_verification_save_rejects_foreign_stale_or_changed_identity(persistent_database, owners, change):
    site = WebsiteEntity.create(owners[0].id, "example.com")
    async with persistent_database.transaction() as session:
        await SQLWebsiteRepository(session).claim(site)
    pending = proof_state(site)
    values = {"owner": {"owner_id": owners[1].id}, "hostname": {"hostname": "other.example"},
              "scheme": {"scheme": "http"}, "created": {"created_at": site.created_at - timedelta(seconds=1)},
              "stale": {}}[change]
    async with persistent_database.transaction() as session:
        expected = site.updated_at - timedelta(seconds=1) if change == "stale" else site.updated_at
        assert await SQLWebsiteRepository(session).save_verification(replace(pending, **values), expected_updated_at=expected) is None
    async with persistent_database.transaction() as session:
        assert await SQLWebsiteRepository(session).get_by_id(site.id, owners[0].id) == site


async def test_save_verification_preserves_proof_and_rejects_stale_or_terminal_writes(persistent_database, owners):
    site = WebsiteEntity.create(owners[0].id, "example.com")
    async with persistent_database.transaction() as session:
        repo = SQLWebsiteRepository(session)
        await repo.claim(site)
        pending = proof_state(site)
        assert await repo.save_verification(pending, expected_updated_at=site.updated_at) == pending
        assert await repo.save_verification(pending, expected_updated_at=site.updated_at) is None
    verified = replace(pending, verified_at=pending.updated_at + timedelta(microseconds=1),
                       updated_at=pending.updated_at + timedelta(microseconds=1))
    async with persistent_database.transaction() as session:
        assert await SQLWebsiteRepository(session).save_verification(verified, expected_updated_at=pending.updated_at) == verified
    with pytest.raises(ValidationException):
        async with persistent_database.transaction() as session:
            await SQLWebsiteRepository(session).save_verification(
                replace(verified, updated_at=verified.updated_at + timedelta(seconds=1)), expected_updated_at=verified.updated_at)
    async with persistent_database.transaction() as session:
        assert await SQLWebsiteRepository(session).get_by_id(site.id, owners[0].id) == verified


@pytest.mark.parametrize("assignment,code", [
    ("owner_id = NULL", "23502"), ("owner_id = 'missing-owner'", "23503"),
    ("id = ''", "23514"), ("hostname = 'EXAMPLE.COM'", "23514"),
    ("hostname = 'example.com.'", "23514"), ("hostname = '127.0.0.1'", "23514"),
    ("hostname = 'app.localhost'", "23514"), ("hostname = 'app.local'", "23514"),
    ("hostname = 'example..com'", "23514"), ("hostname = 'bad_host.example'", "23514"),
    ("hostname = repeat('a',64) || '.example'", "23514"),
    ("hostname = 'مثال.ایران'", "23514"), ("scheme = 'ftp'", "23514"),
    ("updated_at = created_at - interval '1 second'", "23514"),
    ("reservation_expires_at = created_at + interval '25 hours'", "23514"),
    ("challenge_digest = decode('ff','hex')", "23514"),
    ("challenge_digest = decode(repeat('ff',32),'hex')", "23514"),
    ("challenge_issued_at = created_at", "23514"), ("challenge_expires_at = reservation_expires_at", "23514"),
    ("verified_at = created_at", "23514"),
    ("released_at = created_at - interval '1 second'", "23514"),
])
async def test_database_rejects_invalid_state_without_domain_prechecks(persistent_database, owners, assignment, code):
    site = WebsiteEntity.create(owners[0].id, "example.com")
    await insert_raw(persistent_database, site)
    with pytest.raises(IntegrityError) as error:
        async with persistent_database.transaction() as session:
            await session.execute(text("UPDATE websites SET " + assignment))
    assert error.value.orig.sqlstate == code
    async with persistent_database.transaction() as session:
        assert await SQLWebsiteRepository(session).get_by_id(site.id, owners[0].id) == site


async def test_owner_deletion_is_restricted_instead_of_transferring_or_orphaning_site(persistent_database, owners):
    site = WebsiteEntity.create(owners[0].id, "example.com")
    await insert_raw(persistent_database, site)
    with pytest.raises(IntegrityError) as error:
        async with persistent_database.transaction() as session:
            await session.execute(text("DELETE FROM users WHERE id = :owner"), {"owner": owners[0].id})
    assert error.value.orig.sqlstate == "23503"
    async with persistent_database.transaction() as session:
        assert await SQLWebsiteRepository(session).get_by_id(site.id, owners[0].id) == site


@pytest.mark.parametrize("age", [timedelta(days=2), -timedelta(days=1)])
async def test_invalid_candidate_cannot_release_an_expired_claim_even_when_caught(persistent_database, owners, age):
    original = WebsiteEntity.create(owners[0].id, "example.com", now=datetime.now(UTC) - timedelta(days=2))
    await insert_raw(persistent_database, original)
    candidate = WebsiteEntity.create(owners[1].id, "example.com", now=datetime.now(UTC) - age)
    async with persistent_database.transaction() as session:
        repo = SQLWebsiteRepository(session)
        with pytest.raises(ValidationException):
            await repo.claim(candidate)
        assert await repo.get_by_id(original.id, owners[0].id) == original


@pytest.mark.parametrize("state", ["pending", "released", "updated"])
async def test_claim_cannot_insert_preexisting_verification_or_lifecycle_state(persistent_database, owners, state):
    site = WebsiteEntity.create(owners[0].id, "example.com")
    if state == "pending":
        site = proof_state(site)
    elif state == "released":
        site = replace(site, released_at=site.created_at)
    else:
        site = replace(site, updated_at=site.updated_at + timedelta(microseconds=1))
    with pytest.raises(ValidationException):
        async with persistent_database.transaction() as session:
            await SQLWebsiteRepository(session).claim(site)
    async with persistent_database.transaction() as session:
        assert (await SQLWebsiteRepository(session).get_by_owner(owners[0].id, Params())).total == 0


async def test_primary_key_conflict_is_translated_without_exposing_driver_details(persistent_database, owners):
    site = WebsiteEntity.create(owners[0].id, "example.com")
    await insert_raw(persistent_database, site)
    with pytest.raises(ConflictException) as error:
        async with persistent_database.transaction() as session:
            await SQLWebsiteRepository(session).claim(replace(site, hostname="other.example", owner_id=owners[1].id))
    assert str(error.value) == "Website is unavailable" and error.value.details == {}
    assert error.value.__suppress_context__
    async with persistent_database.transaction() as session:
        assert await SQLWebsiteRepository(session).get_by_id(site.id, owners[0].id) == site
