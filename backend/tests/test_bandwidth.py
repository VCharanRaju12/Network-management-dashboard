import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models.device import Device
from app.models.interface import Interface
from app.models.metric import Metric
from app.services.poller import poll_device

pytestmark = pytest.mark.asyncio


async def _make_device_with_interface(session, **overrides):
    device = Device(
        id=uuid.uuid4(),
        name="Bandwidth Test Device",
        ip_address="127.0.0.1",  # loopback always answers ping in CI
        device_type="router",
        status="unknown",
    )
    session.add(device)
    await session.flush()

    now = datetime.now(timezone.utc)
    iface = Interface(
        device_id=device.id,
        if_name="eth0",
        if_index=1,
        is_up=True,
        last_in_octets=1_000_000,
        last_out_octets=500_000,
        last_octets_at=now - timedelta(seconds=30),
        **overrides,
    )
    session.add(iface)
    await session.commit()
    await session.refresh(device)
    await session.refresh(iface)
    return device, iface


async def test_bandwidth_rate_computed_from_counter_delta(admin_user):
    from tests.conftest import TestSessionLocal
    from unittest.mock import AsyncMock, patch

    async with TestSessionLocal() as session:
        device, iface = await _make_device_with_interface(session)
        device.snmp_community = "public"  # presence alone is enough to enter the SNMP branch below

        # 30 seconds elapsed (per _make_device_with_interface), 1,000,000 bytes
        # more received than last time -> (1_000_000 * 8) / 30 / 1e6 ≈ 0.267 Mbps
        fake_snmp_metrics = {"cpu": 12.0}
        fake_snmp_interfaces = [
            {
                "if_index": 1,
                "if_name": "eth0",
                "is_up": True,
                "speed_mbps": 1000,
                "in_octets": iface.last_in_octets + 1_000_000,
                "out_octets": iface.last_out_octets + 500_000,
            }
        ]

        with patch("app.services.poller.poll_snmp_metrics", new=AsyncMock(return_value=fake_snmp_metrics)), \
             patch("app.services.poller.poll_snmp_interfaces", new=AsyncMock(return_value=fake_snmp_interfaces)), \
             patch("app.services.poller.async_ping", new=AsyncMock(return_value=type("R", (), {"is_alive": True})())), \
             patch("app.services.poller.manager.broadcast", new=AsyncMock()):
            await poll_device(device, session)
            await session.commit()

        result = await session.execute(
            __import__("sqlalchemy").select(Metric).where(Metric.metric_type == "bandwidth_in_mbps")
        )
        bandwidth_metrics = result.scalars().all()
        assert len(bandwidth_metrics) == 1
        # ~0.267 Mbps expected; allow a little slack for timing variance in the test itself
        assert 0.2 < bandwidth_metrics[0].value < 0.35


async def test_bandwidth_skipped_on_counter_wraparound(admin_user):
    """A negative delta (counter wrapped around) must not produce a bogus
    negative bandwidth reading — the poller should just skip that interval."""
    from tests.conftest import TestSessionLocal
    from unittest.mock import AsyncMock, patch

    async with TestSessionLocal() as session:
        device, iface = await _make_device_with_interface(session)
        device.snmp_community = "public"

        fake_snmp_interfaces = [
            {
                "if_index": 1,
                "if_name": "eth0",
                "is_up": True,
                "speed_mbps": 1000,
                "in_octets": 100,  # lower than last_in_octets=1_000_000 -> wraparound
                "out_octets": 100,
            }
        ]

        with patch("app.services.poller.poll_snmp_metrics", new=AsyncMock(return_value={})), \
             patch("app.services.poller.poll_snmp_interfaces", new=AsyncMock(return_value=fake_snmp_interfaces)), \
             patch("app.services.poller.async_ping", new=AsyncMock(return_value=type("R", (), {"is_alive": True})())), \
             patch("app.services.poller.manager.broadcast", new=AsyncMock()):
            await poll_device(device, session)
            await session.commit()

        result = await session.execute(
            __import__("sqlalchemy").select(Metric).where(Metric.metric_type == "bandwidth_in_mbps")
        )
        assert result.scalars().all() == []
