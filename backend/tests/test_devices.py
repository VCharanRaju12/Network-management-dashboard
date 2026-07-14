import pytest

pytestmark = pytest.mark.asyncio


async def _create_device(client, admin_token, **overrides):
    payload = {
        "name": "Test Switch",
        "ip_address": "10.0.0.2",
        "device_type": "switch",
        "poll_interval_seconds": 30,
    }
    payload.update(overrides)
    response = await client.post(
        "/api/devices", json=payload, headers={"Authorization": f"Bearer {admin_token}"}
    )
    return response


async def test_create_and_list_device(client, admin_token):
    create_response = await _create_device(client, admin_token)
    assert create_response.status_code == 201
    device_id = create_response.json()["id"]

    list_response = await client.get(
        "/api/devices", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert list_response.status_code == 200
    ids = [d["id"] for d in list_response.json()]
    assert device_id in ids


async def test_get_single_device(client, admin_token):
    created = (await _create_device(client, admin_token)).json()

    response = await client.get(
        f"/api/devices/{created['id']}", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    assert response.json()["ip_address"] == "10.0.0.2"


async def test_get_nonexistent_device_404s(client, admin_token):
    response = await client.get(
        "/api/devices/00000000-0000-0000-0000-000000000000",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 404


async def test_update_device(client, admin_token):
    created = (await _create_device(client, admin_token)).json()

    response = await client.patch(
        f"/api/devices/{created['id']}",
        json={"name": "Renamed Switch"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed Switch"


async def test_delete_device(client, admin_token):
    created = (await _create_device(client, admin_token)).json()

    delete_response = await client.delete(
        f"/api/devices/{created['id']}", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert delete_response.status_code == 204

    get_response = await client.get(
        f"/api/devices/{created['id']}", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert get_response.status_code == 404


async def test_device_metrics_endpoint_empty_by_default(client, admin_token):
    created = (await _create_device(client, admin_token)).json()

    response = await client.get(
        f"/api/devices/{created['id']}/metrics", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    assert response.json() == []


async def test_device_interfaces_endpoint_empty_by_default(client, admin_token):
    created = (await _create_device(client, admin_token)).json()

    response = await client.get(
        f"/api/devices/{created['id']}/interfaces", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    assert response.json() == []


async def test_invalid_device_type_rejected(client, admin_token):
    response = await _create_device(client, admin_token, device_type="toaster")
    assert response.status_code == 422
