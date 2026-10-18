import sys
import os
import warnings
from contextlib import asynccontextmanager
from collections.abc import Iterator
from pathlib import Path
from typing import TYPE_CHECKING

import pytest
from tests.support.browser_client import BrowserClient as TestClient

pytest_plugins = ["pytester"]

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Synthetic test configuration only. Serving configuration has no secret/origin fallback.
os.environ.setdefault("PUBLIC_ORIGIN", "https://testserver")
os.environ.setdefault("CSRF_SECRET_KEY", "test-only-csrf-key-never-for-deployment-0001")

warnings.filterwarnings("ignore", message="I/O operation on closed file")

if TYPE_CHECKING:
    from app.interface.dto import Role, User


@pytest.fixture
def test_client() -> Iterator[TestClient]:
    from app.infra.repositories.in_memory import registry
    from app.main import create_app
    from app.infra.core.seed import seed
    from app.interface.dependencies.user_dependencies import get_user_repository
    from app.interface.dependencies.role_dependencies import get_role_repository
    from app.interface.dependencies.session_dependencies import get_session_repository
    from app.interface.repository.session_repository_interface import ISessionRepository
    from app.application.use_cases.auth.session_models import SessionRecord
    from datetime import UTC, datetime, timedelta
    from unittest.mock import AsyncMock
    from app.interface.login_route import get_login_limiter
    from app.application.use_cases.auth.interfaces import RegistrationLimitDecision

    # CRUD characterization remains isolated in memory. Product
    # session behavior and persistence are tested separately with real PostgreSQL.
    records = {}
    session_repository = AsyncMock(spec=ISessionRepository)

    async def create_session(digest, user_id, *, remember_me, idle_seconds, absolute_seconds):
        now = datetime.now(UTC)
        record = SessionRecord(digest=digest,user_id=user_id,remember_me=remember_me,
            idle_timeout_seconds=idle_seconds,created_at=now,last_seen_at=now,
            idle_expires_at=now+timedelta(seconds=idle_seconds),
            absolute_expires_at=now+timedelta(seconds=absolute_seconds))
        records[digest] = record
        return record

    async def rotate_session(previous_digest, digest, user_id, **policy):
        record = await create_session(digest,user_id,**policy)
        records.pop(previous_digest,None)
        return record

    async def resolve_session(digest, *, touch=True):
        record = records.get(digest)
        return record if record is not None and record.is_valid_at(datetime.now(UTC)) else None

    async def revoke_session(digest):
        return records.pop(digest, None) is not None

    session_repository.create.side_effect = create_session
    session_repository.rotate.side_effect = rotate_session
    session_repository.resolve.side_effect = resolve_session
    session_repository.revoke.side_effect = revoke_session

    @asynccontextmanager
    async def memory_lifespan(application):
        await seed()
        yield

    app = create_app(lifespan_handler=memory_lifespan)
    app.dependency_overrides[get_user_repository] = lambda: registry.user_repository
    app.dependency_overrides[get_role_repository] = lambda: registry.role_repository
    app.dependency_overrides[get_session_repository] = lambda: session_repository
    limiter = AsyncMock()
    limiter.consume.return_value = RegistrationLimitDecision(True)
    app.dependency_overrides[get_login_limiter] = lambda request: limiter

    # Reset before lifespan seeds this test, and after shutdown even on failure.
    registry.reset()
    try:
        with TestClient(app) as client:
            try:
                yield client
            finally:
                client.cookies.clear()
    finally:
        registry.reset()
        records.clear()


@pytest.fixture
def admin_session(test_client: TestClient) -> str:
    response = test_client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "FixtureAdmin123!"},
    )
    assert response.status_code == 200, response.text
    return test_client.cookies["__Host-datano_session"]


@pytest.fixture
def admin_auth(admin_session: str) -> dict[str, str]:
    return {"Cookie": f"__Host-datano_session={admin_session}"}


@pytest.fixture
def created_user(test_client: TestClient, admin_auth: dict[str, str]) -> "User":
    from app.interface.dto import User

    response = test_client.post(
        "/api/users/",
        headers=admin_auth,
        json={
            "first_name": "Fixture",
            "last_name": "User",
            "email": "fixture-user@example.test",
            "username": "fixture-user",
            "password": "Fixture password 123!",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["success"] is True
    return User.model_validate(response.json()["payload"])


@pytest.fixture
def created_role(test_client: TestClient, admin_auth: dict[str, str]) -> "Role":
    from app.interface.dto import Role

    response = test_client.post(
        "/api/roles/", headers=admin_auth, json={"name": "Fixture role"}
    )
    assert response.status_code == 200, response.text
    assert response.json()["success"] is True
    return Role.model_validate(response.json()["payload"])
