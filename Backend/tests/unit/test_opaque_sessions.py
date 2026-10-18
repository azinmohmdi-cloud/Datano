import hashlib
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.auth.session_models import IssuedSession, SessionPolicy, SessionRecord
from app.application.use_cases.auth.session_service import SessionService
from app.infra.services.session_token_service import OpaqueSessionTokens
from app.interface.repository.session_repository_interface import ISessionRepository


@pytest.mark.parametrize("remember,expected", [(False,(1800,43200)),(True,(604800,2592000))])
def test_policy_matches_approved_mvp(remember, expected):
    assert SessionPolicy().timeouts(remember) == expected


@pytest.mark.parametrize("changes", [
    {"idle_seconds":0}, {"absolute_seconds":-1}, {"remember_idle_seconds":0},
    {"remember_absolute_seconds":0}, {"idle_seconds":43201},
    {"remember_idle_seconds":2592001},
])
def test_invalid_policy_cannot_disable_expiry(changes):
    with pytest.raises(ValueError):
        SessionPolicy(**changes)


def test_token_generation_explicitly_requests_32_random_bytes(monkeypatch):
    calls=[]
    def token_urlsafe(size):
        calls.append(size)
        return "A" * 43
    monkeypatch.setattr("secrets.token_urlsafe", token_urlsafe)
    assert OpaqueSessionTokens().generate() == "A" * 43
    assert calls == [32]


def test_token_digest_is_exact_sha256_and_cannot_be_used_as_identifier():
    service=OpaqueSessionTokens()
    token="Ab0_" * 10 + "XYZ"
    digest=service.digest(token)
    assert digest == hashlib.sha256(token.encode("ascii")).digest()
    assert len(digest) == 32
    assert service.digest(digest.hex()) is None
    assert service.digest(token.lower()) != digest


@pytest.mark.parametrize("token", [None,"", "x"*42, "x"*44, "ف"*43, "a.b.c", "x"*10000, " " + "x"*42],
    ids=["null","empty","short","long","unicode","jwt","oversized","whitespace"])
async def test_malformed_identifiers_never_reach_storage(token):
    repo=AsyncMock(spec=ISessionRepository)
    service=SessionService(repo,OpaqueSessionTokens())
    assert await service.resolve(token) is None
    assert await service.revoke(token) is False
    repo.resolve.assert_not_awaited()
    repo.revoke.assert_not_awaited()


def test_credentials_are_absent_from_metadata_representations():
    now=datetime(2026,10,18,tzinfo=UTC)
    token="A"*43
    record=SessionRecord(digest=b"s"*32,user_id="user",remember_me=False,idle_timeout_seconds=1800,
        created_at=now,last_seen_at=now,idle_expires_at=now+timedelta(minutes=30),absolute_expires_at=now+timedelta(hours=12))
    issued=IssuedSession(token,record)
    assert token not in repr(issued) and repr(record.digest) not in repr(record)


@pytest.mark.parametrize("offset,valid", [(timedelta(microseconds=-1),False),(timedelta(),True),(timedelta(minutes=30),False)])
def test_record_boundaries_are_exact(offset,valid):
    now=datetime(2026,10,18,tzinfo=UTC)
    record=SessionRecord(digest=b"s"*32,user_id="user",remember_me=False,idle_timeout_seconds=1800,
        created_at=now,last_seen_at=now,idle_expires_at=now+timedelta(minutes=30),absolute_expires_at=now+timedelta(hours=12))
    assert record.is_valid_at(now+offset) is valid


def test_config_exposes_approved_session_lifetimes():
    from app.infra.core.config import Config
    config = Config(_env_file=None)
    assert tuple(getattr(config, key, None) for key in (
        "session_idle_seconds", "session_absolute_seconds",
        "remember_session_idle_seconds", "remember_session_absolute_seconds",
    )) == (1800, 43200, 604800, 2592000)


@pytest.mark.parametrize("key", ["SESSION_IDLE_SECONDS", "SESSION_ABSOLUTE_SECONDS",
    "REMEMBER_SESSION_IDLE_SECONDS", "REMEMBER_SESSION_ABSOLUTE_SECONDS"])
def test_config_rejects_nonpositive_session_lifetimes(key):
    from pydantic import ValidationError
    from app.infra.core.config import Config
    with pytest.raises(ValidationError):
        Config(_env_file=None, **{key:0})


async def test_invalid_generator_cannot_issue_or_disclose_its_output():
    from unittest.mock import Mock
    tokens=Mock()
    tokens.generate.return_value="invalid secret generator output"
    tokens.digest.return_value=None
    repo=AsyncMock(spec=ISessionRepository)
    with pytest.raises(ValueError) as error:
        await SessionService(repo,tokens).issue("user")
    assert tokens.generate.return_value not in str(error.value)
    repo.create.assert_not_awaited()
