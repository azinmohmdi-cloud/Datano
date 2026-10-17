class TestRolesAPI:
    def test_get_roles(self, test_client, admin_auth, created_role):
        response = test_client.get(
            "/api/roles/", params={"size": 100}, headers=admin_auth
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        roles = {role["id"]: role for role in data["payload"]["items"]}
        assert created_role.id in roles
        assert roles[created_role.id]["name"] == created_role.name
        assert data["payload"]["total"] >= len(roles)

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

    def test_get_role_by_id(self, test_client, admin_auth, created_role):
        response = test_client.get(f"/api/roles/{created_role.id}", headers=admin_auth)
        assert response.status_code == 200
        assert response.json()["payload"]["id"] == created_role.id
        assert response.json()["payload"]["name"] == created_role.name

    def test_get_role_not_found(self, test_client, admin_auth):
        response = test_client.get("/api/roles/nonexistent-id", headers=admin_auth)
        assert response.status_code == 404

    def test_update_role(self, test_client, admin_auth, created_role):
        response = test_client.put(
            f"/api/roles/{created_role.id}",
            headers=admin_auth,
            json={"name": "Updated"},
        )
        assert response.status_code == 200
        assert response.json()["payload"]["name"] == "Updated"

    def test_delete_role(self, test_client, admin_auth, created_role):
        response = test_client.delete(f"/api/roles/{created_role.id}", headers=admin_auth)
        assert response.status_code == 200
        assert response.json()["payload"]["id"] == created_role.id

        get_resp = test_client.get(f"/api/roles/{created_role.id}", headers=admin_auth)
        assert get_resp.status_code == 404

    def test_assign_and_remove_permission(self, test_client, admin_auth, created_role):
        perm_resp = test_client.get("/api/auth/permissions", headers=admin_auth)
        assert perm_resp.status_code == 200
        perm_id = next(
            permission["id"] for permission in perm_resp.json()["payload"]
            if permission["title"] == "permissions:read"
        )

        assign_resp = test_client.post(
            f"/api/roles/{created_role.id}/permissions/{perm_id}",
            headers=admin_auth,
        )
        assert assign_resp.status_code == 200
        assert perm_id in assign_resp.json()["payload"]["permission_ids"]

        remove = test_client.delete(
            f"/api/roles/{created_role.id}/permissions/{perm_id}",
            headers=admin_auth,
        )
        assert remove.status_code == 200
        assert perm_id not in remove.json()["payload"]["permission_ids"]
