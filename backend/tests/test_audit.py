import pytest

pytestmark = pytest.mark.asyncio


async def test_device_creation_is_audited(client, admin_token):
    create_response = await client.post(
        "/api/devices",
        json={"name": "Audited Device", "ip_address": "10.0.0.5", "device_type": "router"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    device_id = create_response.json()["id"]

    audit_response = await client.get(
        "/api/audit-log", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert audit_response.status_code == 200
    entries = audit_response.json()
    matching = [e for e in entries if e["action"] == "device.created" and e["target_id"] == device_id]
    assert len(matching) == 1
    assert matching[0]["details"]["name"] == "Audited Device"


async def test_device_deletion_is_audited(client, admin_token):
    create_response = await client.post(
        "/api/devices",
        json={"name": "To Be Deleted", "ip_address": "10.0.0.6", "device_type": "router"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    device_id = create_response.json()["id"]

    await client.delete(
        f"/api/devices/{device_id}", headers={"Authorization": f"Bearer {admin_token}"}
    )

    audit_response = await client.get(
        "/api/audit-log", headers={"Authorization": f"Bearer {admin_token}"}
    )
    entries = audit_response.json()
    matching = [e for e in entries if e["action"] == "device.deleted" and e["target_id"] == device_id]
    assert len(matching) == 1


async def test_user_creation_is_audited(client, admin_token):
    await client.post(
        "/api/users",
        json={
            "username": "audited_viewer",
            "email": "audited@example.com",
            "password": "password123",
            "role": "viewer",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    audit_response = await client.get(
        "/api/audit-log", headers={"Authorization": f"Bearer {admin_token}"}
    )
    entries = audit_response.json()
    matching = [e for e in entries if e["action"] == "user.created"]
    assert len(matching) == 1
    assert matching[0]["details"]["username"] == "audited_viewer"
