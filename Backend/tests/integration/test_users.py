class TestUsersAPI:
    def test_get_users(self, test_client, admin_auth, created_user):
        response = test_client.get(
            "/api/users/", params={"size": 100}, headers=admin_auth
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        users = {user["id"]: user for user in data["payload"]["items"]}
        assert created_user.id in users
        assert users[created_user.id]["username"] == created_user.username
        assert data["payload"]["total"] >= len(users)
        assert all("hashed_password" not in user for user in users.values())

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
                "password": "Fixture password 123!",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["payload"]["username"] == "janesmith"
        assert data["payload"]["email"] == "jane@example.com"

    def test_get_user_by_id(self, test_client, admin_auth, created_user):
        response = test_client.get(f"/api/users/{created_user.id}", headers=admin_auth)
        assert response.status_code == 200
        data = response.json()
        assert data["payload"]["id"] == created_user.id

    def test_get_user_not_found(self, test_client, admin_auth):
        response = test_client.get("/api/users/nonexistent-id", headers=admin_auth)
        assert response.status_code == 404

    def test_update_user(self, test_client, admin_auth, created_user):
        response = test_client.put(
            f"/api/users/{created_user.id}",
            headers=admin_auth,
            json={"first_name": "Updated", "last_name": "Name"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["payload"]["id"] == created_user.id
        assert data["payload"]["first_name"] == "Updated"

    def test_delete_user(self, test_client, admin_auth, created_user):
        response = test_client.delete(f"/api/users/{created_user.id}", headers=admin_auth)
        assert response.status_code == 200
        data = response.json()
        assert data["payload"]["id"] == created_user.id

    def test_assign_and_remove_role(
        self, test_client, admin_auth, created_user, created_role
    ):
        assign_resp = test_client.post(
            f"/api/users/{created_user.id}/roles/{created_role.id}",
            headers=admin_auth,
        )
        assert assign_resp.status_code == 200
        assigned_ids = {role["id"] for role in assign_resp.json()["payload"]["roles"]}
        assert assigned_ids == {created_role.id}

        remove_resp = test_client.delete(
            f"/api/users/{created_user.id}/roles/{created_role.id}",
            headers=admin_auth,
        )
        assert remove_resp.status_code == 200
        assert len(remove_resp.json()["payload"]["roles"]) == 0
