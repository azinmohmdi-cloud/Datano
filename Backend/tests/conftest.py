import sys
import warnings
from contextlib import asynccontextmanager
from collections.abc import Iterator
from pathlib import Path
from typing import TYPE_CHECKING

import pytest
from fastapi.testclient import TestClient

pytest_plugins = ["pytester"]

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

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

    @asynccontextmanager
    async def memory_lifespan(application):
        await seed()
        yield

    app = create_app(lifespan_handler=memory_lifespan)
    app.dependency_overrides[get_user_repository] = lambda: registry.user_repository
    app.dependency_overrides[get_role_repository] = lambda: registry.role_repository

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


@pytest.fixture
def admin_token(test_client: TestClient) -> str:
    response = test_client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Secret123"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    return data["payload"]["token"]


@pytest.fixture
def admin_auth(admin_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}


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
            "password": "password123",
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
