import pytest


class TestUsersAPI:
    @pytest.fixture
    def admin_auth(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}

    def test_get_users(self, test_client, admin_auth):
        response = test_client.get("/api/users/", headers=admin_auth)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["payload"]["items"]) == 1
        assert data["payload"]["items"][0]["username"] == "admin"

    def test_get_users_unauthorized(self, test_client):
        response = test_client.get("/api/users/")
        assert response.status_code == 401

    def test_create_user(self, test_client, admin_auth):
        response = test_client.post(
            "/api/users/",
            headers=admin_auth,
            json={
                "first_name": "Jane",
                "last_name": "Smith",
                "email": "jane@example.com",
                "username": "janesmith",
                "password": "password123",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["payload"]["username"] == "janesmith"
        assert data["payload"]["email"] == "jane@example.com"

    def test_get_user_by_id(self, test_client, admin_auth):
        response = test_client.get("/api/users/", headers=admin_auth)
        user_id = response.json()["payload"]["items"][0]["id"]

        response = test_client.get(f"/api/users/{user_id}", headers=admin_auth)
        assert response.status_code == 200
        data = response.json()
        assert data["payload"]["id"] == user_id

    def test_get_user_not_found(self, test_client, admin_auth):
        response = test_client.get("/api/users/nonexistent-id", headers=admin_auth)
        assert response.status_code == 404

    def test_update_user(self, test_client, admin_auth):
        response = test_client.get("/api/users/", headers=admin_auth)
        user_id = response.json()["payload"]["items"][0]["id"]

        response = test_client.put(
            f"/api/users/{user_id}",
            headers=admin_auth,
            json={"first_name": "Updated", "last_name": "Name"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["payload"]["first_name"] == "Updated"

    def test_delete_user(self, test_client, admin_auth):
        create_resp = test_client.post(
            "/api/users/",
            headers=admin_auth,
            json={
                "first_name": "Temp",
                "last_name": "User",
                "email": "temp@example.com",
                "username": "tempuser",
                "password": "password123",
            },
        )
        user_id = create_resp.json()["payload"]["id"]

        response = test_client.delete(f"/api/users/{user_id}", headers=admin_auth)
        assert response.status_code == 200
        data = response.json()
        assert data["payload"]["id"] == user_id

    def test_assign_and_remove_role(self, test_client, admin_auth):
        create_resp = test_client.post(
            "/api/users/",
            headers=admin_auth,
            json={
                "first_name": "Role",
                "last_name": "Test",
                "email": "roletest@example.com",
                "username": "roletest",
                "password": "password123",
            },
        )
        user_id = create_resp.json()["payload"]["id"]

        roles_resp = test_client.get("/api/roles/", headers=admin_auth)
        role_id = roles_resp.json()["payload"]["items"][0]["id"]

        assign_resp = test_client.post(
            f"/api/users/{user_id}/roles/{role_id}",
            headers=admin_auth,
        )
        assert assign_resp.status_code == 200
        assert len(assign_resp.json()["payload"]["roles"]) == 1

        remove_resp = test_client.delete(
            f"/api/users/{user_id}/roles/{role_id}",
            headers=admin_auth,
        )
        assert remove_resp.status_code == 200
        assert len(remove_resp.json()["payload"]["roles"]) == 0
