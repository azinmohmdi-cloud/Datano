import pytest


def test_ping_endpoint(test_client):
    response = test_client.get("/api/ping")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["message"] == "pong"
