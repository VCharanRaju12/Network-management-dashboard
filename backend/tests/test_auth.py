import pytest

pytestmark = pytest.mark.asyncio


async def test_login_success(client, admin_user):
    response = await client.post(
        "/api/auth/login", json={"username": "test_admin", "password": "adminpass123"}
    )
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


async def test_login_wrong_password(client, admin_user):
    response = await client.post(
        "/api/auth/login", json={"username": "test_admin", "password": "wrongpassword"}
    )
    assert response.status_code == 401


async def test_login_nonexistent_user(client):
    response = await client.post(
        "/api/auth/login", json={"username": "nobody", "password": "whatever123"}
    )
    assert response.status_code == 401


async def test_protected_endpoint_requires_token(client):
    response = await client.get("/api/devices")
    assert response.status_code in (401, 403)


async def test_refresh_token_issues_new_access_token(client, admin_user):
    login = await client.post(
        "/api/auth/login", json={"username": "test_admin", "password": "adminpass123"}
    )
    refresh_token = login.json()["refresh_token"]

    response = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    assert "access_token" in response.json()
