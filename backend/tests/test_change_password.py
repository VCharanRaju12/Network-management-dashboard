import pytest

pytestmark = pytest.mark.asyncio


async def test_change_password_success(client, admin_token):
    response = await client.post(
        "/api/auth/change-password",
        json={"current_password": "adminpass123", "new_password": "newpassword456"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 204

    # Old password no longer works
    old_login = await client.post(
        "/api/auth/login", json={"username": "test_admin", "password": "adminpass123"}
    )
    assert old_login.status_code == 401

    # New password works
    new_login = await client.post(
        "/api/auth/login", json={"username": "test_admin", "password": "newpassword456"}
    )
    assert new_login.status_code == 200


async def test_change_password_wrong_current_password(client, admin_token):
    response = await client.post(
        "/api/auth/change-password",
        json={"current_password": "wrongpassword", "new_password": "newpassword456"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 401

    # Original password still works — nothing changed
    login = await client.post(
        "/api/auth/login", json={"username": "test_admin", "password": "adminpass123"}
    )
    assert login.status_code == 200


async def test_change_password_too_short_rejected(client, admin_token):
    response = await client.post(
        "/api/auth/change-password",
        json={"current_password": "adminpass123", "new_password": "short"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 422


async def test_change_password_requires_auth(client):
    response = await client.post(
        "/api/auth/change-password",
        json={"current_password": "whatever", "new_password": "newpassword456"},
    )
    assert response.status_code in (401, 403)


async def test_viewer_can_change_own_password(client, viewer_token):
    response = await client.post(
        "/api/auth/change-password",
        json={"current_password": "viewerpass123", "new_password": "newviewerpass456"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert response.status_code == 204
