import pytest

pytestmark = pytest.mark.asyncio


async def test_devices_pagination_limit_and_total_count(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    for i in range(5):
        await client.post(
            "/api/devices",
            json={"name": f"Device {i}", "ip_address": f"10.0.1.{i}", "device_type": "router"},
            headers=headers,
        )

    response = await client.get("/api/devices?limit=2&offset=0", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 2
    assert response.headers["x-total-count"] == "5"


async def test_devices_pagination_offset_moves_window(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    created_names = []
    for i in range(3):
        r = await client.post(
            "/api/devices",
            json={"name": f"Ordered {i}", "ip_address": f"10.0.2.{i}", "device_type": "router"},
            headers=headers,
        )
        created_names.append(r.json()["name"])

    first_page = await client.get("/api/devices?limit=1&offset=0", headers=headers)
    second_page = await client.get("/api/devices?limit=1&offset=1", headers=headers)
    assert first_page.json()[0]["id"] != second_page.json()[0]["id"]


async def test_users_pagination_total_count(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    for i in range(3):
        await client.post(
            "/api/users",
            json={
                "username": f"paguser{i}",
                "email": f"paguser{i}@example.com",
                "password": "password123",
                "role": "viewer",
            },
            headers=headers,
        )

    response = await client.get("/api/users?limit=2", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 2
    # +1 for the admin fixture user itself
    assert int(response.headers["x-total-count"]) == 4


async def test_audit_log_pagination_total_count(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    for i in range(4):
        await client.post(
            "/api/devices",
            json={"name": f"Audited {i}", "ip_address": f"10.0.3.{i}", "device_type": "switch"},
            headers=headers,
        )

    response = await client.get("/api/audit-log?limit=2", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 2
    assert int(response.headers["x-total-count"]) >= 4
