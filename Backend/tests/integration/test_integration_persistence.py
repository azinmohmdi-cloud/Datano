from datetime import timedelta
import asyncio
import base64
from dataclasses import asdict, replace
import os
import subprocess
import sys

import pytest
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.exc import IntegrityError

from app.application.use_cases.integration.credentials import OAuthCredential
from app.domain.entities import UserEntity, WebsiteEntity
from app.domain.entities.integration_entity import IntegrationEntity
from app.domain.error.exceptions import ConflictException, ResourceNotFoundException, ServiceUnavailableException, ValidationException
from app.infra.database.connection import Database
from app.infra.database.models import IntegrationCredentialRow, IntegrationRow, UserRow, WebsiteRow
from app.infra.repositories.postgres.integration_repository import SQLIntegrationRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.infra.repositories.postgres.website_repository import SQLWebsiteRepository
from app.infra.services.integration_credentials import AESCredentialCipher
from tests.postgres import isolated_postgres_url, persistent_database


@pytest.fixture
def cipher():
    return AESCredentialCipher(b"k" * 32)


@pytest.fixture
async def sites(persistent_database):
    result = []
    async with persistent_database.transaction() as session:
        now = await session.scalar(select(func.clock_timestamp()))
        for index in range(2):
            actor = UserEntity.create(first_name="نام", last_name="تست", email=f"integration{index}@example.test",
                username=f"integration{index}", hashed_password="test-only-hash")
            actor.is_active = True
            await SQLUserRepository(session).create(actor)
            site = WebsiteEntity.create(actor.id, f"integration{index}.example.com", now=now - timedelta(minutes=1))
            repo = SQLWebsiteRepository(session)
            await repo.claim(site)
            pending = site.issue_challenge(b"d" * 32, now=now - timedelta(seconds=30))
            await repo.save_verification(pending, expected_updated_at=site.updated_at)
            verified = pending.verify_challenge(now=now - timedelta(seconds=10))
            await repo.save_verification(verified, expected_updated_at=pending.updated_at)
            result.append((actor, verified))
    return result


async def test_selection_persists_owner_site_source_and_property(persistent_database, sites, cipher):
    actor, site = sites[0]
    async with persistent_database.transaction() as session:
        result = await SQLIntegrationRepository(session, cipher).save_selection(actor.id, site.id, "gsc",
            "sc-domain:integration0.example.com", OAuthCredential("test-only-refresh"), expected=None)
        assert isinstance(result, IntegrationEntity)
        assert (result.owner_id, result.website_id, result.source, result.property_id) == (
            actor.id, site.id, "gsc", "sc-domain:integration0.example.com")


async def store(database, actor, site, cipher, *, source="gsc", property_id="property-A", token="test-only-refresh", expected=None):
    async with database.transaction() as session:
        return await SQLIntegrationRepository(session, cipher).save_selection(actor.id, site.id, source,
            property_id, OAuthCredential(token) if token is not None else None, expected=expected)


async def test_ciphertext_and_metadata_survive_pool_and_process_restart(persistent_database, isolated_postgres_url, sites, cipher):
    actor, site = sites[0]
    saved = await store(persistent_database, actor, site, cipher)
    async with persistent_database.transaction() as session:
        row = await session.get(IntegrationCredentialRow, saved.id)
        assert b"test-only-refresh" not in row.ciphertext and b"k" * 32 not in row.ciphertext
        assert not any("token" in field or "cipher" in field for field in asdict(saved))
    await persistent_database.dispose()
    reopened = Database(isolated_postgres_url)
    try:
        async with reopened.transaction() as session:
            repo = SQLIntegrationRepository(session, AESCredentialCipher(b"k" * 32))
            assert await repo.get_active(actor.id, site.id, "gsc") == saved
            assert (await repo.get_credential(actor.id, site.id, saved.id)).refresh_token == "test-only-refresh"
    finally:
        await reopened.dispose()
    # A fresh interpreter reconstructs storage/crypto; no parent process registry.
    code = '''import asyncio,os
from app.infra.core.config import Config
from app.infra.database.connection import Database
from app.infra.repositories.postgres.integration_repository import SQLIntegrationRepository
from app.infra.services.integration_credentials import AESCredentialCipher
async def main():
    database=Database(os.environ["DATANO_RESTART_URL"])
    try:
        async with database.transaction() as session:
            repo=SQLIntegrationRepository(session,AESCredentialCipher.from_config(Config(_env_file=None)))
            row=await repo.get_active(os.environ["DATANO_OWNER"],os.environ["DATANO_SITE"],"gsc")
            assert row.id==os.environ["DATANO_INTEGRATION"]
            assert (await repo.get_credential(row.owner_id,row.website_id,row.id)).refresh_token=="test-only-refresh"
        print("restart read verified")
    finally: await database.dispose()
asyncio.run(main())
'''
    result = subprocess.run([sys.executable, "-c", code], env={**os.environ,
        "DATANO_RESTART_URL": isolated_postgres_url.render_as_string(hide_password=False),
        "DATANO_OWNER": actor.id, "DATANO_SITE": site.id, "DATANO_INTEGRATION": saved.id,
        "INTEGRATION_CREDENTIAL_KEY": base64.urlsafe_b64encode(b"k" * 32).decode()},
        capture_output=True, text=True, timeout=20)
    assert result.returncode == 0 and result.stdout.strip() == "restart read verified"
    assert "test-only-refresh" not in result.stderr


async def test_replacing_property_retires_identity_and_erases_old_local_credential(persistent_database, sites, cipher):
    actor, site = sites[0]
    first = await store(persistent_database, actor, site, cipher)
    second = await store(persistent_database, actor, site, cipher, property_id="property-B", token="second-token", expected=first)
    third = await store(persistent_database, actor, site, cipher, property_id="property-A", token="third-token", expected=second)
    assert len({first.id, second.id, third.id}) == 3
    async with persistent_database.transaction() as session:
        repo = SQLIntegrationRepository(session, cipher)
        assert await repo.get_active(actor.id, site.id, "gsc") == third
        old = await repo.get_by_id(actor.id, site.id, first.id)
        assert old.property_id == "property-A" and old.retired_at is not None
        assert old.created_at == first.created_at and old.revision == 2
        assert await session.get(IntegrationCredentialRow, first.id) is None
        assert await session.get(IntegrationCredentialRow, second.id) is None
        assert (await repo.get_credential(actor.id, site.id, third.id)).refresh_token == "third-token"
        for old_id in (first.id, second.id):
            with pytest.raises(ResourceNotFoundException): await repo.get_credential(actor.id, site.id, old_id)


async def test_history_references_never_move_to_new_selection(persistent_database, sites, cipher):
    actor, site = sites[0]
    first = await store(persistent_database, actor, site, cipher)
    async with persistent_database.transaction() as session:
        # Test-only stand-in for future FK consumers; no analytics schema is shipped.
        await session.execute(text("CREATE TABLE history_probe (integration_id text REFERENCES integrations(id), observation integer)"))
        await session.execute(text("INSERT INTO history_probe VALUES (:integration_id, 42)"), {"integration_id": first.id})
    second = await store(persistent_database, actor, site, cipher, property_id="property-B", expected=first)
    async with persistent_database.transaction() as session:
        assert await session.scalar(text("SELECT observation FROM history_probe WHERE integration_id = :id"), {"id": first.id}) == 42
        assert await session.scalar(text("SELECT observation FROM history_probe WHERE integration_id = :id"), {"id": second.id}) is None
        assert await session.scalar(select(IntegrationRow.property_id).where(IntegrationRow.id == first.id)) == "property-A"


@pytest.mark.parametrize("token", ["rotated-refresh", None])
async def test_same_property_renews_same_identity_and_handles_missing_refresh_token(persistent_database, sites, cipher, token):
    actor, site = sites[0]
    first = await store(persistent_database, actor, site, cipher)
    async with persistent_database.transaction() as session:
        previous = await session.scalar(select(IntegrationCredentialRow.ciphertext).where(IntegrationCredentialRow.integration_id == first.id))
    second = await store(persistent_database, actor, site, cipher, token=token, expected=first)
    assert second.id == first.id and second.created_at == first.created_at and second.revision == 2
    async with persistent_database.transaction() as session:
        repo = SQLIntegrationRepository(session, cipher)
        assert (await repo.get_credential(actor.id, site.id, second.id)).refresh_token == (token or "test-only-refresh")
        assert await session.scalar(select(func.count()).select_from(IntegrationRow)) == 1
        assert await session.scalar(select(IntegrationCredentialRow.ciphertext).where(IntegrationCredentialRow.integration_id == first.id)) != previous
        with pytest.raises(ServiceUnavailableException): cipher.decrypt(previous, second.credential_context())


@pytest.mark.parametrize("existing", [False, True])
async def test_new_property_needs_credential_and_does_not_inherit_another_property(persistent_database, sites, cipher, existing):
    actor, site = sites[0]
    first = await store(persistent_database, actor, site, cipher) if existing else None
    with pytest.raises(ValidationException):
        await store(persistent_database, actor, site, cipher, property_id="new-property", token=None, expected=first)
    async with persistent_database.transaction() as session:
        assert await SQLIntegrationRepository(session, cipher).get_active(actor.id, site.id, "gsc") == first


async def test_sources_and_owners_have_independent_active_selections(persistent_database, sites, cipher):
    saved = []
    for actor, site in sites:
        for source in ("ga4", "gsc", "ads"):
            saved.append(await store(persistent_database, actor, site, cipher, source=source, property_id="same-opaque-id"))
    assert len({row.id for row in saved}) == 6
    async with persistent_database.transaction() as session:
        repo = SQLIntegrationRepository(session, cipher)
        for row in saved:
            assert await repo.get_active(row.owner_id, row.website_id, row.source) == row


@pytest.mark.parametrize("operation", ["read", "metadata", "credential", "write"])
async def test_cross_owner_access_has_no_identity_or_secret_disclosure(persistent_database, sites, cipher, operation):
    actor, site = sites[0]; other, _ = sites[1]
    first = await store(persistent_database, actor, site, cipher)
    async with persistent_database.transaction() as session:
        repo = SQLIntegrationRepository(session, cipher)
        with pytest.raises(ResourceNotFoundException) as error:
            if operation == "read": await repo.get_active(other.id, site.id, "gsc")
            if operation == "metadata": await repo.get_by_id(other.id, site.id, first.id)
            if operation == "credential": await repo.get_credential(other.id, site.id, first.id)
            if operation == "write": await repo.save_selection(other.id, site.id, "gsc", "private", OAuthCredential("private-token"), expected=None)
        assert error.value.details == {"resource_type": "Website", "identifier": "requested record"}
        assert actor.id not in str(error.value) and "private" not in str(error.value)


@pytest.mark.parametrize("state", ["unverified", "released", "inactive", "missing"])
async def test_unusable_site_or_owner_cannot_read_or_select(persistent_database, sites, cipher, state):
    actor, site = sites[0]
    first = await store(persistent_database, actor, site, cipher)
    async with persistent_database.transaction() as session:
        if state == "unverified": await session.execute(update(WebsiteRow).where(WebsiteRow.id == site.id).values(verified_at=None))
        if state == "released": await session.execute(update(WebsiteRow).where(WebsiteRow.id == site.id).values(released_at=site.updated_at))
        if state == "inactive": await session.execute(update(UserRow).where(UserRow.id == actor.id).values(is_active=False))
    website_id = "absent-site" if state == "missing" else site.id
    for operation in ("read", "metadata", "credential", "write"):
        with pytest.raises(ResourceNotFoundException):
            async with persistent_database.transaction() as session:
                repo = SQLIntegrationRepository(session, cipher)
                if operation == "read": await repo.get_active(actor.id, website_id, "gsc")
                if operation == "metadata": await repo.get_by_id(actor.id, website_id, first.id)
                if operation == "credential": await repo.get_credential(actor.id, website_id, first.id)
                if operation == "write": await repo.save_selection(actor.id, website_id, "gsc", "other", OAuthCredential("token"), expected=first)


async def test_missing_or_other_sites_integration_is_not_found(persistent_database, sites, cipher):
    actor, site = sites[0]; other, other_site = sites[1]
    first = await store(persistent_database, other, other_site, cipher)
    async with persistent_database.transaction() as session:
        repo = SQLIntegrationRepository(session, cipher)
        assert await repo.get_active(actor.id, site.id, "gsc") is None
        for integration_id in ("absent", first.id):
            assert await repo.get_by_id(actor.id, site.id, integration_id) is None
            with pytest.raises(ResourceNotFoundException): await repo.get_credential(actor.id, site.id, integration_id)


@pytest.mark.parametrize("change", ["key", "ciphertext", "context", "missing", "swap"])
async def test_invalid_encrypted_storage_fails_closed(persistent_database, sites, cipher, change, caplog):
    actor, site = sites[0]
    first = await store(persistent_database, actor, site, cipher)
    second = await store(persistent_database, actor, site, cipher, source="ga4")
    async with persistent_database.transaction() as session:
        if change == "ciphertext":
            row = await session.get(IntegrationCredentialRow, first.id)
            row.ciphertext = row.ciphertext[:-1] + bytes([row.ciphertext[-1] ^ 1])
        if change == "context": await session.execute(update(IntegrationRow).where(IntegrationRow.id == first.id).values(property_id="forged-property"))
        if change == "missing": await session.execute(delete(IntegrationCredentialRow).where(IntegrationCredentialRow.integration_id == first.id))
        if change == "swap":
            replacement = await session.scalar(select(IntegrationCredentialRow.ciphertext).where(IntegrationCredentialRow.integration_id == second.id))
            await session.execute(update(IntegrationCredentialRow).where(IntegrationCredentialRow.integration_id == first.id).values(ciphertext=replacement))
    selected_cipher = AESCredentialCipher(b"x" * 32) if change == "key" else cipher
    with pytest.raises(ServiceUnavailableException) as error:
        async with persistent_database.transaction() as session:
            await SQLIntegrationRepository(session, selected_cipher).get_credential(actor.id, site.id, first.id)
    assert error.value.details == {} and str(error.value) == "Integration credential is unavailable"
    assert "test-only-refresh" not in caplog.text


async def test_stale_selection_cannot_replace_new_property_or_credentials(persistent_database, sites, cipher):
    actor, site = sites[0]
    first = await store(persistent_database, actor, site, cipher)
    second = await store(persistent_database, actor, site, cipher, expected=first)
    for expected in (None, first, replace(second, owner_id="forged")):
        with pytest.raises(ConflictException): await store(persistent_database, actor, site, cipher, property_id="stale", expected=expected)
    async with persistent_database.transaction() as session:
        assert await SQLIntegrationRepository(session, cipher).get_active(actor.id, site.id, "gsc") == second


@pytest.mark.parametrize("existing", [False, True])
async def test_concurrent_selection_has_one_winner_and_no_lost_update(persistent_database, sites, cipher, existing):
    actor, site = sites[0]
    first = await store(persistent_database, actor, site, cipher) if existing else None
    start = asyncio.Event()
    async def select_property(property_id):
        await start.wait()
        try: return await store(persistent_database, actor, site, cipher, property_id=property_id, expected=first)
        except ConflictException: return "stale"
    tasks = [asyncio.create_task(select_property(value)) for value in ("property-B", "property-C")]
    start.set()
    results = await asyncio.wait_for(asyncio.gather(*tasks), timeout=10)
    assert sum(isinstance(value, IntegrationEntity) for value in results) == 1
    assert results.count("stale") == 1
    winner = next(value for value in results if isinstance(value, IntegrationEntity))
    async with persistent_database.transaction() as session:
        assert await SQLIntegrationRepository(session, cipher).get_active(actor.id, site.id, "gsc") == winner
        assert await session.scalar(select(func.count()).select_from(IntegrationCredentialRow)) == 1


async def test_replacement_rolls_back_retirement_and_new_credential_together(persistent_database, sites, cipher):
    actor, site = sites[0]
    first = await store(persistent_database, actor, site, cipher)
    with pytest.raises(RuntimeError, match="rollback"):
        async with persistent_database.transaction() as session:
            await SQLIntegrationRepository(session, cipher).save_selection(actor.id, site.id, "gsc", "other", OAuthCredential("other-token"), expected=first)
            raise RuntimeError("rollback")
    async with persistent_database.transaction() as session:
        repo = SQLIntegrationRepository(session, cipher)
        assert await repo.get_active(actor.id, site.id, "gsc") == first
        assert (await repo.get_credential(actor.id, site.id, first.id)).refresh_token == "test-only-refresh"
        assert await session.scalar(select(func.count()).select_from(IntegrationRow)) == 1


@pytest.mark.parametrize("change,code", [("owner", "23503"), ("source", "23514"), ("property", "23514"), ("revision", "23514"), ("duplicate", "23505")])
async def test_database_enforces_owner_source_property_revision_and_single_active(persistent_database, sites, cipher, change, code):
    actor, site = sites[0]
    first = await store(persistent_database, actor, site, cipher)
    values = asdict(replace(first, id="raw-record"))
    if change == "owner":
        values["owner_id"] = sites[1][0].id
        values["source"] = "ga4"  # Isolate the FK failure from the active GSC unique index.
    if change == "source": values["source"] = "bad"
    if change == "property": values["property_id"] = ""
    if change == "revision": values["revision"] = 0
    with pytest.raises(IntegrityError) as error:
        async with persistent_database.transaction() as session:
            session.add(IntegrationRow(**values)); await session.flush()
    assert error.value.orig.sqlstate == code


@pytest.mark.parametrize("envelope", [b"", b"plaintext-secret", b"\x02" + b"x" * 40, b"\x01" + b"x" * 16413])
async def test_database_rejects_invalid_envelope_framing(persistent_database, sites, cipher, envelope):
    actor, site = sites[0]
    first = await store(persistent_database, actor, site, cipher)
    with pytest.raises(IntegrityError) as error:
        async with persistent_database.transaction() as session:
            await session.execute(update(IntegrationCredentialRow).where(IntegrationCredentialRow.integration_id == first.id).values(ciphertext=envelope))
    assert error.value.orig.sqlstate == "23514"
