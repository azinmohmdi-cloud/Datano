import warnings
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "app"))

warnings.filterwarnings("ignore", message="I/O operation on closed file")


@pytest.fixture(scope="session")
def test_client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


@pytest.fixture(scope="session")
def admin_token(test_client):
    response = test_client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Secret123"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    return data["payload"]["token"]
