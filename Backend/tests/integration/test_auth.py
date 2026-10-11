import pytest


class TestLogin:
    def test_login_success(self, test_client):
        response = test_client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "Secret123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "Login successful"
        assert "token" in data["payload"]

    def test_login_wrong_password(self, test_client):
        response = test_client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "wrongpassword"},
        )
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert data["message"] == "Incorrect username or password"

    def test_login_nonexistent_user(self, test_client):
        response = test_client.post(
            "/api/auth/login",
            json={"username": "nobody", "password": "password123"},
        )
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False


class TestMe:
    def test_get_me_authenticated(self, test_client, admin_token):
        response = test_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["payload"]["username"] == "admin"
        assert data["payload"]["email"] == "admin@example.com"

    def test_get_me_no_token(self, test_client):
        response = test_client.get("/api/auth/me")
        assert response.status_code == 401

    def test_get_me_invalid_token(self, test_client):
        response = test_client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalidtoken"},
        )
        assert response.status_code == 401
