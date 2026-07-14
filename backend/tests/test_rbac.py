import pytest

pytestmark = pytest.mark.asyncio


async def test_viewer_cannot_create_device(client, viewer_token):
    response = await client.post(
        "/api/devices",
        json={"name": "Test Router", "ip_address": "10.0.0.1", "device_type": "router"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert response.status_code == 403


async def test_viewer_can_list_devices(client, viewer_token):
    response = await client.get("/api/devices", headers={"Authorization": f"Bearer {viewer_token}"})
    assert response.status_code == 200


async def test_admin_can_create_device(client, admin_token):
    response = await client.post(
        "/api/devices",
        json={"name": "Test Router", "ip_address": "10.0.0.1", "device_type": "router"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Test Router"


async def test_viewer_cannot_create_user(client, viewer_token):
    response = await client.post(
        "/api/users",
        json={"username": "newuser", "email": "new@example.com", "password": "password123", "role": "viewer"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert response.status_code == 403


async def test_viewer_cannot_view_audit_log(client, viewer_token):
    response = await client.get("/api/audit-log", headers={"Authorization": f"Bearer {viewer_token}"})
    assert response.status_code == 403


async def test_admin_can_view_audit_log(client, admin_token):
    response = await client.get("/api/audit-log", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
