"""
Device poller.

Every cycle, for every device:
1. ICMP ping -> online/offline status (works against any device, zero config)
2. If the device has an SNMP community configured, also collect real
   CPU/memory/interface metrics via app/services/snmp_poller.py

Runs on a simple asyncio interval loop so there's no extra infrastructure
(Celery/Redis) required to get real data flowing on day one.
"""

import asyncio
import logging

from icmplib import async_ping
from sqlalchemy import select

from app.api.routes.ws import manager
from app.db.session import AsyncSessionLocal
from app.models.device import Device
from app.models.metric import Metric
from app.services.snmp_poller import poll_snmp_metrics

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

    # Reachability metric — always recorded, works for any device
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

    # Real SNMP metrics (CPU, memory, interface counts) — only for devices
    # that have a community string configured. Silently skipped otherwise.
    if device.snmp_community:
        try:
            snmp_metrics = await poll_snmp_metrics(device.ip_address, device.snmp_community)
        except Exception:
            logger.exception("SNMP poll failed for %s (%s)", device.name, device.ip_address)
            snmp_metrics = {}

        for metric_type, value in snmp_metrics.items():
            db.add(Metric(device_id=device.id, metric_type=metric_type, value=value))
            await manager.broadcast(
                {
                    "device_id": str(device.id),
                    "status": new_status,
                    "metric_type": metric_type,
                    "value": value,
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
