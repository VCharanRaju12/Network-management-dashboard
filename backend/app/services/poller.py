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
from datetime import datetime, timezone

from icmplib import async_ping
from sqlalchemy import select

from app.api.routes.ws import manager
from app.db.session import AsyncSessionLocal
from app.core.security import decrypt_secret
from app.models.device import Device
from app.models.interface import Interface
from app.models.metric import Metric
from app.services.audit_logger import log_action
from app.services.notifier import notify_status_change
from app.services.snmp_poller import poll_snmp_interfaces, poll_snmp_metrics

logger = logging.getLogger("poller")


async def poll_device(device: Device, db) -> None:
    try:
        result = await async_ping(device.ip_address, count=2, timeout=1, privileged=False)
        is_online = result.is_alive
    except Exception as exc:
        logger.warning("Ping failed for %s (%s): %s", device.name, device.ip_address, exc)
        is_online = False

    new_status = "online" if is_online else "offline"
    previous_status = device.status
    status_changed = previous_status != new_status
    if status_changed:
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

    # Persist real transitions (not every poll tick, just actual changes) to
    # the audit log — this is what backs the frontend's live activity feed
    # and alerting with real, queryable history rather than only in-memory
    # WebSocket messages that vanish on page refresh.
    if status_changed and previous_status != "unknown":
        await log_action(
            db,
            actor_id=None,  # system-initiated, not a user action
            action="device.status_changed",
            target_type="device",
            target_id=device.id,
            details={"from": previous_status, "to": new_status, "device_name": device.name},
        )
        await manager.broadcast(
            {
                "device_id": str(device.id),
                "status": new_status,
                "metric_type": "status_change",
                "value": 1.0 if new_status == "online" else 0.0,
                "device_name": device.name,
                "previous_status": previous_status,
            }
        )

        # Real email/webhook alerting — no-ops quietly if nothing is
        # configured (see app/services/notifier.py + .env.example).
        try:
            await notify_status_change(device.name, device.ip_address, previous_status, new_status)
        except Exception:
            logger.exception("Alert notification failed for %s", device.name)

    # Real SNMP metrics (CPU, memory, interface counts) — only for devices
    # that have a community string configured. Silently skipped otherwise.
    if device.snmp_community:
        community = decrypt_secret(device.snmp_community)
        try:
            snmp_metrics = await poll_snmp_metrics(device.ip_address, community)
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

        # Per-interface detail (name, up/down, speed) — upserts into the
        # Interface table so the frontend can show real per-port status.
        try:
            snmp_interfaces = await poll_snmp_interfaces(device.ip_address, community)
        except Exception:
            logger.exception("SNMP interface poll failed for %s (%s)", device.name, device.ip_address)
            snmp_interfaces = []

        if snmp_interfaces:
            existing_result = await db.execute(
                select(Interface).where(Interface.device_id == device.id)
            )
            existing_by_index = {iface.if_index: iface for iface in existing_result.scalars().all()}
            now = datetime.now(timezone.utc)

            for iface_data in snmp_interfaces:
                existing = existing_by_index.get(iface_data["if_index"])

                if existing:
                    iface_row = existing
                else:
                    iface_row = Interface(device_id=device.id, if_index=iface_data["if_index"])
                    db.add(iface_row)

                # Bandwidth rate = (new counter - old counter) / elapsed seconds,
                # converted from bytes to megabits. Requires a previous reading
                # to compare against, so the very first poll for an interface
                # just records a baseline with no rate yet.
                in_octets = iface_data["in_octets"]
                out_octets = iface_data["out_octets"]
                if (
                    in_octets is not None
                    and out_octets is not None
                    and iface_row.last_in_octets is not None
                    and iface_row.last_out_octets is not None
                    and iface_row.last_octets_at is not None
                ):
                    elapsed = (now - iface_row.last_octets_at).total_seconds()
                    in_delta = in_octets - iface_row.last_in_octets
                    out_delta = out_octets - iface_row.last_out_octets

                    # 32-bit SNMP counters wrap around to 0 periodically —
                    # a negative delta means that happened, so skip this
                    # interval rather than reporting a bogus negative rate.
                    if elapsed > 0 and in_delta >= 0 and out_delta >= 0:
                        in_mbps = (in_delta * 8) / elapsed / 1_000_000
                        out_mbps = (out_delta * 8) / elapsed / 1_000_000
                        db.add(
                            Metric(
                                device_id=device.id,
                                interface_id=iface_row.id if existing else None,
                                metric_type="bandwidth_in_mbps",
                                value=in_mbps,
                            )
                        )
                        db.add(
                            Metric(
                                device_id=device.id,
                                interface_id=iface_row.id if existing else None,
                                metric_type="bandwidth_out_mbps",
                                value=out_mbps,
                            )
                        )

                iface_row.if_name = iface_data["if_name"]
                iface_row.is_up = iface_data["is_up"]
                iface_row.speed_mbps = iface_data["speed_mbps"]
                if in_octets is not None and out_octets is not None:
                    iface_row.last_in_octets = in_octets
                    iface_row.last_out_octets = out_octets
                    iface_row.last_octets_at = now


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
