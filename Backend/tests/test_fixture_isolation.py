import ast
from pathlib import Path

import pytest
from pytest import Pytester


def test_test_names_are_unique() -> None:
    """Duplicate definitions silently remove cases before pytest can collect them."""
    duplicates: list[str] = []
    for path in sorted(Path(__file__).parent.rglob("test_*.py")):
        tree = ast.parse(path.read_text(), filename=str(path))
        for scope in ast.walk(tree):
            if not isinstance(scope, (ast.Module, ast.ClassDef)):
                continue
            names: set[str] = set()
            for node in scope.body:
                if (
                    isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
                    and node.name.startswith("test_")
                ):
                    if node.name in names:
                        duplicates.append(f"{path.name}:{node.lineno}:{node.name}")
                    names.add(node.name)
    assert not duplicates, duplicates


@pytest.mark.parametrize("resource", ["users", "roles", "cookies", "refresh_tokens"])
@pytest.mark.parametrize("order", [("alpha", "beta"), ("beta", "alpha")])
def test_http_fixture_lifecycles_are_independent(
    pytester: Pytester, resource: str, order: tuple[str, str]
) -> None:
    """Exercise the real fixtures across two pytest items in a fresh subprocess."""
    backend_root = Path(__file__).resolve().parents[1]
    pytester.makeconftest(
        f"import sys\nsys.path.insert(0, {str(backend_root)!r})\n"
        "from tests.conftest import admin_token, test_client\n"
    )
    pytester.makepyfile(
        test_lifecycle=f'''
from pathlib import Path

import pytest

from app.infra.repositories.in_memory.registry import refresh_token_repository

RESOURCE = {resource!r}


async def exercise(client, token, label):
    headers = {{"Authorization": f"Bearer {{token}}"}}
    if RESOURCE == "cookies":
        marker_present = "isolation-marker" in client.cookies
        assert marker_present is False
        client.cookies.set("isolation-marker", label)
    elif RESOURCE == "refresh_tokens":
        previous = Path("previous-refresh-token")
        if previous.exists():
            old_token = previous.read_text()
            previous_token_present = (
                await refresh_token_repository.get_refresh_token_by_token(old_token)
            ) is not None
            assert previous_token_present is False
            response = client.post(
                "/api/auth/refresh", headers={{"Cookie": f"refresh_token={{old_token}}"}}
            )
            assert response.status_code == 401
        previous.write_text(client.cookies["refresh_token"])
    elif RESOURCE == "users":
        response = client.get("/api/users/", params={{"size": 100}}, headers=headers)
        assert response.status_code == 200
        assert not {{"isolation-alpha", "isolation-beta"}} & {{
            user["username"] for user in response.json()["payload"]["items"]
        }}
        response = client.post("/api/users/", headers=headers, json={{
            "first_name": "Isolation", "last_name": label,
            "email": f"isolation-{{label}}@example.test",
            "username": f"isolation-{{label}}", "password": "password123",
        }})
        assert response.status_code == 200
    else:
        response = client.get("/api/roles/", params={{"size": 100}}, headers=headers)
        assert response.status_code == 200
        assert not {{"Isolation alpha", "Isolation beta"}} & {{
            role["name"] for role in response.json()["payload"]["items"]
        }}
        response = client.post(
            "/api/roles/", headers=headers, json={{"name": f"Isolation {{label}}"}}
        )
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_alpha(test_client, admin_token):
    await exercise(test_client, admin_token, "alpha")


@pytest.mark.asyncio
async def test_beta(test_client, admin_token):
    await exercise(test_client, admin_token, "beta")
'''
    )
    result = pytester.runpytest_subprocess(
        *(f"test_lifecycle.py::test_{name}" for name in order),
        "-q", "--tb=short", timeout=30,
    )
    result.assert_outcomes(passed=2)


def test_http_fixtures_clean_up_after_a_failed_test(pytester: Pytester) -> None:
    backend_root = Path(__file__).resolve().parents[1]
    pytester.makeconftest(
        f"import sys\nsys.path.insert(0, {str(backend_root)!r})\n"
        "from tests.conftest import (admin_auth, admin_token, created_role, created_user, test_client)\n"
    )
    pytester.makepyfile(
        test_teardown='''
import pytest

from app.infra.repositories.in_memory.registry import (
    refresh_token_repository, role_repository, user_repository,
)

previous_client = None
previous_refresh_token = None


def test_failure(test_client, admin_auth, created_user, created_role):
    global previous_client, previous_refresh_token
    previous_client = test_client
    previous_refresh_token = test_client.cookies["refresh_token"]
    response = test_client.post(
        f"/api/users/{created_user.id}/roles/{created_role.id}", headers=admin_auth,
    )
    assert response.status_code == 200
    test_client.cookies.set("isolation-marker", "failed-test")
    pytest.fail("Intentional failure to exercise fixture teardown")


@pytest.mark.asyncio
async def test_after_failure():
    # Deliberately do not request a new client: this verifies teardown itself.
    assert previous_client is not None
    cookie_count = len(previous_client.cookies)
    assert cookie_count == 0
    assert await user_repository.get_by_username("fixture-user") is None
    assert await role_repository.get_by_name("Fixture role") is None
    previous_token_present = (
        await refresh_token_repository.get_refresh_token_by_token(previous_refresh_token)
    ) is not None
    assert previous_token_present is False
'''
    )
    result = pytester.runpytest_subprocess(
        "test_teardown.py::test_failure", "test_teardown.py::test_after_failure",
        "-q", "--tb=short", timeout=30,
    )
    # Only the intentional failure is allowed; the cleanup observer must pass.
    result.assert_outcomes(failed=1, passed=1)
