"""
Real SNMP metric collection, layered on top of app/services/snmp.py.

OIDs used (all standard, publicly documented):
- UCD-SNMP-MIB (Linux net-snmp agents — good for local testing):
    laLoad.1     1.3.6.1.4.1.2021.10.1.3.1   1-minute load average (used as a CPU proxy)
    memTotalReal 1.3.6.1.4.1.2021.4.5.0      total real memory, KB
    memAvailReal 1.3.6.1.4.1.2021.4.6.0      available real memory, KB
- IF-MIB (universal — works on real routers/switches/APs, not just Linux):
    ifDescr      1.3.6.1.2.1.2.2.1.2   interface name, per ifIndex
    ifOperStatus 1.3.6.1.2.1.2.2.1.8   1 = up, 2 = down
    ifInOctets   1.3.6.1.2.1.2.2.1.10  cumulative bytes received
    ifOutOctets  1.3.6.1.2.1.2.2.1.16  cumulative bytes sent

Bandwidth (ifInOctets/ifOutOctets) is a running counter, not a rate — so we
keep the last reading in memory per (device_id, if_index) and turn the delta
between two polls into bits-per-second. This resets if the backend restarts,
which is fine for an MVP (the next poll after restart just skips one rate
calculation until it has two readings to compare).
"""

import logging
import time
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.interface import Interface
from app.models.metric import Metric
from app.services.snmp import SnmpError, snmp_get, snmp_walk

logger = logging.getLogger("snmp_poller")

OID_LOAD_1MIN = "1.3.6.1.4.1.2021.10.1.3.1"
OID_MEM_TOTAL = "1.3.6.1.4.1.2021.4.5.0"
OID_MEM_AVAIL = "1.3.6.1.4.1.2021.4.6.0"
OID_IF_DESCR = "1.3.6.1.2.1.2.2.1.2"
OID_IF_OPER_STATUS = "1.3.6.1.2.1.2.2.1.8"
OID_IF_IN_OCTETS = "1.3.6.1.2.1.2.2.1.10"
OID_IF_OUT_OCTETS = "1.3.6.1.2.1.2.2.1.16"

# In-memory rate-calculation cache: (device_id, if_index) -> (timestamp, in_octets, out_octets)
_last_octets: dict[tuple[uuid.UUID, int], tuple[float, int, int]] = {}


def _index_from_oid(oid: str, base_oid: str) -> int:
    """'1.3.6.1.2.1.2.2.1.2.3' with base '1.3.6.1.2.1.2.2.1.2' -> ifIndex 3"""
    return int(oid[len(base_oid) + 1 :])


async def collect_cpu_and_memory(device, db: AsyncSession) -> list[dict]:
    """Returns a list of broadcast-ready dicts for any metrics we could collect."""
    broadcasts: list[dict] = []

    try:
        load_str = await snmp_get(device.ip_address, device.snmp_community, OID_LOAD_1MIN)
        cpu_value = float(load_str)
        db.add(Metric(device_id=device.id, metric_type="cpu_load", value=cpu_value))
        broadcasts.append({"device_id": str(device.id), "metric_type": "cpu_load", "value": cpu_value})
    except (SnmpError, ValueError) as exc:
        logger.debug("CPU OID not available for %s: %s", device.name, exc)

    try:
        total_str = await snmp_get(device.ip_address, device.snmp_community, OID_MEM_TOTAL)
        avail_str = await snmp_get(device.ip_address, device.snmp_community, OID_MEM_AVAIL)
        total, avail = float(total_str), float(avail_str)
        if total > 0:
            mem_percent = (total - avail) / total * 100
            db.add(Metric(device_id=device.id, metric_type="memory_percent", value=mem_percent))
            broadcasts.append(
                {"device_id": str(device.id), "metric_type": "memory_percent", "value": mem_percent}
            )
    except (SnmpError, ValueError) as exc:
        logger.debug("Memory OIDs not available for %s: %s", device.name, exc)

    return broadcasts


async def collect_interfaces(device, db: AsyncSession) -> list[dict]:
    """Walks IF-MIB, upserts Interface rows, and records bandwidth rate metrics."""
    broadcasts: list[dict] = []

    try:
        descr_rows = await snmp_walk(device.ip_address, device.snmp_community, OID_IF_DESCR)
        status_rows = await snmp_walk(device.ip_address, device.snmp_community, OID_IF_OPER_STATUS)
        in_rows = await snmp_walk(device.ip_address, device.snmp_community, OID_IF_IN_OCTETS)
        out_rows = await snmp_walk(device.ip_address, device.snmp_community, OID_IF_OUT_OCTETS)
    except SnmpError as exc:
        logger.debug("IF-MIB not available for %s: %s", device.name, exc)
        return broadcasts

    names = {_index_from_oid(oid, OID_IF_DESCR): val for oid, val in descr_rows}
    statuses = {_index_from_oid(oid, OID_IF_OPER_STATUS): val for oid, val in status_rows}
    in_octets = {_index_from_oid(oid, OID_IF_IN_OCTETS): int(val) for oid, val in in_rows}
    out_octets = {_index_from_oid(oid, OID_IF_OUT_OCTETS): int(val) for oid, val in out_rows}

    now = time.monotonic()

    for if_index, if_name in names.items():
        is_up = statuses.get(if_index) == "1"

        result = await db.execute(
            select(Interface).where(Interface.device_id == device.id, Interface.if_index == if_index)
        )
        interface = result.scalar_one_or_none()
        if interface is None:
            interface = Interface(device_id=device.id, if_name=if_name, if_index=if_index, is_up=is_up)
            db.add(interface)
            await db.flush()  # need interface.id before we can attach metrics to it
        else:
            interface.if_name = if_name
            interface.is_up = is_up

        cur_in = in_octets.get(if_index)
        cur_out = out_octets.get(if_index)
        if cur_in is None or cur_out is None:
            continue

        cache_key = (device.id, if_index)
        previous = _last_octets.get(cache_key)
        if previous is not None:
            prev_time, prev_in, prev_out = previous
            elapsed = now - prev_time
            if elapsed > 0:
                # max(0, ...) guards against a counter reset/wrap producing a negative delta
                in_bps = max(0, cur_in - prev_in) * 8 / elapsed
                out_bps = max(0, cur_out - prev_out) * 8 / elapsed

                db.add(Metric(device_id=device.id, interface_id=interface.id, metric_type="bandwidth_in_bps", value=in_bps))
                db.add(Metric(device_id=device.id, interface_id=interface.id, metric_type="bandwidth_out_bps", value=out_bps))
                broadcasts.append(
                    {
                        "device_id": str(device.id),
                        "interface": if_name,
                        "metric_type": "bandwidth_in_bps",
                        "value": in_bps,
                    }
                )

        _last_octets[cache_key] = (now, cur_in, cur_out)

    return broadcasts


async def poll_device_snmp(device, db: AsyncSession) -> list[dict]:
    """Entry point: collect everything SNMP can give us for one device."""
    if not device.snmp_community:
        return []

    broadcasts = await collect_cpu_and_memory(device, db)
    broadcasts += await collect_interfaces(device, db)
    return broadcasts
