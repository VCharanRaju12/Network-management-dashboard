"""
MVP device poller.

Today: uses ICMP ping to determine online/offline status — this works against
any real device right away with zero device-side config.

Next step (see README "Extending the poller"): add SNMP GET calls via pysnmp
for CPU/memory/interface counters on devices that have `snmp_community` set,
so status is not just reachability but real performance metrics.

Runs on a simple interval loop via APScheduler so there's no extra
infrastructure (Celery/Redis) required to get real data flowing on day one.
"""

import asyncio
import logging

from icmplib import async_ping
from sqlalchemy import select

from app.api.routes.ws import manager
from app.db.session import AsyncSessionLocal
from app.models.device import Device
from app.models.metric import Metric

logger = logging.getLogger("poller")


async def poll_device(device: Device, db) -> None:
    try:
        result = await async_ping(device.ip_address, count=2, timeout=1, privileged=False)
        is_online = result.is_alive
    except Exception as exc:
        logger.warning("Ping failed for %s (%s): %s", device.name, device.ip_address, exc)
        is_online = False

    new_status = "online" if is_online else "offline"
    if device.status != new_status:
        device.status = new_status

    # TODO: replace this placeholder with real pysnmp GETs (CPU/memory OIDs vary by vendor)
    # when device.snmp_community is set. For now we only record reachability-based status
    # so the dashboard has *something* real to show without requiring SNMP-enabled gear.
    metric = Metric(device_id=device.id, metric_type="reachability", value=1.0 if is_online else 0.0)
    db.add(metric)

    await manager.broadcast(
        {
            "device_id": str(device.id),
            "status": new_status,
            "metric_type": "reachability",
            "value": metric.value,
        }
    )


async def poll_all_devices() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Device))
        devices = result.scalars().all()

        for device in devices:
            await poll_device(device, db)

        await db.commit()


async def poller_loop(interval_seconds: int = 30) -> None:
    while True:
        try:
            await poll_all_devices()
        except Exception:
            logger.exception("Poll cycle failed")
        await asyncio.sleep(interval_seconds)
