import pytest
from sqlalchemy import select

from app.core.security import decrypt_secret, encrypt_secret
from app.models.device import Device


def test_encrypt_decrypt_round_trip():
    original = "my-secret-community-string"
    encrypted = encrypt_secret(original)
    assert encrypted != original
    assert decrypt_secret(encrypted) == original


def test_decrypt_gracefully_handles_preexisting_plaintext():
    # Devices created before encryption was added have raw plaintext in the
    # snmp_community column — decrypt_secret must not blow up on those.
    assert decrypt_secret("already-plaintext-value") == "already-plaintext-value"


@pytest.mark.asyncio
async def test_snmp_community_is_encrypted_in_database(client, admin_token):
    response = await client.post(
        "/api/devices",
        json={
            "name": "SNMP Device",
            "ip_address": "10.0.0.9",
            "device_type": "router",
            "snmp_community": "public",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 201
    device_id = response.json()["id"]

    # Reach past the API (which never exposes snmp_community anyway) to
    # check the actual raw column value in the database.
    from tests.conftest import TestSessionLocal

    async with TestSessionLocal() as session:
        result = await session.execute(select(Device).where(Device.id == device_id))
        device = result.scalar_one()
        assert device.snmp_community != "public"
        assert decrypt_secret(device.snmp_community) == "public"


@pytest.mark.asyncio
async def test_snmp_community_never_returned_by_api(client, admin_token):
    response = await client.post(
        "/api/devices",
        json={
            "name": "SNMP Device 2",
            "ip_address": "10.0.0.10",
            "device_type": "router",
            "snmp_community": "public",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert "snmp_community" not in response.json()
