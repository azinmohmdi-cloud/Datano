import pytest


class TestRolesAPI:
    @pytest.fixture
    def admin_auth(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}

    def test_get_roles(self, test_client, admin_auth):
        response = test_client.get("/api/roles/", headers=admin_auth)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["payload"]["items"]) == 1

    def test_get_roles_unauthorized(self, test_client):
        response = test_client.get("/api/roles/")
        assert response.status_code == 401

    def test_create_role(self, test_client, admin_auth):
        response = test_client.post(
            "/api/roles/",
            headers=admin_auth,
            json={"name": "Viewer"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["payload"]["name"] == "Viewer"

    def test_get_role_by_id(self, test_client, admin_auth):
        create_resp = test_client.post(
            "/api/roles/",
            headers=admin_auth,
            json={"name": "Manager"},
        )
        role_id = create_resp.json()["payload"]["id"]

        response = test_client.get(f"/api/roles/{role_id}", headers=admin_auth)
        assert response.status_code == 200
        assert response.json()["payload"]["name"] == "Manager"

    def test_get_role_not_found(self, test_client, admin_auth):
        response = test_client.get("/api/roles/nonexistent-id", headers=admin_auth)
        assert response.status_code == 404

    def test_update_role(self, test_client, admin_auth):
        create_resp = test_client.post(
            "/api/roles/",
            headers=admin_auth,
            json={"name": "Temp"},
        )
        role_id = create_resp.json()["payload"]["id"]

        response = test_client.put(
            f"/api/roles/{role_id}",
            headers=admin_auth,
            json={"name": "Updated"},
        )
        assert response.status_code == 200
        assert response.json()["payload"]["name"] == "Updated"

    def test_delete_role(self, test_client, admin_auth):
        create_resp = test_client.post(
            "/api/roles/",
            headers=admin_auth,
            json={"name": "ToDelete"},
        )
        role_id = create_resp.json()["payload"]["id"]

        response = test_client.delete(f"/api/roles/{role_id}", headers=admin_auth)
        assert response.status_code == 200
        assert response.json()["payload"]["id"] == role_id

        get_resp = test_client.get(f"/api/roles/{role_id}", headers=admin_auth)
        assert get_resp.status_code == 404

    def test_assign_and_remove_permission(self, test_client, admin_auth):
        create_resp = test_client.post(
            "/api/roles/",
            headers=admin_auth,
            json={"name": "PermTest"},
        )
        role_id = create_resp.json()["payload"]["id"]

        perm_resp = test_client.get("/api/auth/permissions", headers=admin_auth)
        perm_id = perm_resp.json()["payload"][1]["id"]

        assign_resp = test_client.post(
            f"/api/roles/{role_id}/permissions/{perm_id}",
            headers=admin_auth,
        )
        assert assign_resp.status_code == 200
        assert perm_id in assign_resp.json()["payload"]["permission_ids"]

        remove = test_client.delete(
            f"/api/roles/{role_id}/permissions/{perm_id}",
            headers=admin_auth,
        )
        assert remove.status_code == 200
        assert perm_id not in remove.json()["payload"]["permission_ids"]
