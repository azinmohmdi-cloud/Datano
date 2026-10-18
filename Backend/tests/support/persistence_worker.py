"""A fresh application process; credentials below belong only to test fixtures."""
import asyncio
import json
import os
import sys

from fastapi.testclient import TestClient

from app.domain.entities import UserEntity
from app.infra.core.config import Config
from app.infra.database.connection import Database
from app.infra.repositories.postgres.role_repository import SQLRoleRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.infra.services.password_service import BcryptPasswordService
from app.infra.utils.auth.permission import Permission
from app.main import create_app

PASSWORD = "TestOnly123!"


async def provision_test_actor(url: str) -> None:
    database = Database(url)
    try:
        async with database.transaction() as session:
            role = await SQLRoleRepository(session).get_by_name("Admin")
            assert role is not None
            actor = UserEntity.create(first_name="Test", last_name="Actor", email="test-actor@example.test",
                username="test-actor", hashed_password=BcryptPasswordService().hash(PASSWORD))
            actor.activate()
            users = SQLUserRepository(session)
            await users.create(actor)
            await users.assign_role(actor.id, role.id)
    finally:
        await database.dispose()


def run(phase: str) -> dict:
    url = os.environ["DATANO_TEST_DATABASE_URL"]
    settings = Config(_env_file=None, DATABASE_URL=url)
    with TestClient(create_app(settings)) as client:
        if phase == "write":
            asyncio.run(provision_test_actor(url))
        response = client.post("/api/auth/login", json={"username":"test-actor","password":PASSWORD})
        assert response.status_code == 200
        headers = {"Authorization": "Bearer " + response.json()["payload"]["token"]}
        if phase == "write":
            response = client.post("/api/users/", headers=headers, json={"first_name":"پایدار","last_name":"آزمون",
                "email":"persisted@example.test","username":"persisted","password":PASSWORD})
            assert response.status_code == 200
            person = response.json()["payload"]
            response = client.post("/api/roles/", headers=headers, json={"name":"Restart editor","permission_ids":[Permission.Users_Read.value]})
            assert response.status_code == 200
            role = response.json()["payload"]
            response = client.post(f"/api/users/{person['id']}/roles/{role['id']}", headers=headers)
            assert response.status_code == 200
            response = client.put(f"/api/users/{person['id']}", headers=headers, json={"is_active":True})
            assert response.status_code == 200
            manifest = {"user_id":person["id"],"role_id":role["id"],"created_at":person["created_at"]}
        else:
            manifest = json.loads(os.environ["DATANO_TEST_EXPECTED_RECORDS"])
        response = client.get(f"/api/users/{manifest['user_id']}", headers=headers)
        assert response.status_code == 200
        person = response.json()["payload"]
        assert "hashed_password" not in person and person["first_name"] == "پایدار"
        assert person["created_at"] == manifest["created_at"] and person["is_active"] is True
        assert person["roles"][0]["id"] == manifest["role_id"]
        assert person["roles"][0]["name"] == "Restart editor"
        assert person["roles"][0]["permission_ids"] == [Permission.Users_Read.value]
        response = client.get(f"/api/roles/{manifest['role_id']}", headers=headers)
        assert response.status_code == 200 and response.json()["payload"]["name"] == "Restart editor"
        response = client.get("/api/users/not-a-uuid", headers=headers)
        assert response.status_code == 404
        response = client.post("/api/users/", headers=headers, json={"first_name":"Duplicate","last_name":"Test",
            "email":"persisted@example.test","username":"duplicate-person","password":PASSWORD})
        assert response.status_code == 409
        response = client.post("/api/auth/login", json={"username":"persisted","password":PASSWORD})
        assert response.status_code == 200
        restricted = {"Authorization":"Bearer " + response.json()["payload"]["token"]}
        assert client.get("/api/users/", headers=restricted).status_code == 200
        assert client.delete(f"/api/roles/{manifest['role_id']}", headers=restricted).status_code == 403
    return manifest


if __name__ == "__main__":
    print(json.dumps(run(sys.argv[1]), ensure_ascii=False))
