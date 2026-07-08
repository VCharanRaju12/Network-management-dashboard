"""
Real SNMP-based metric collection, using standard MIB-II / HOST-RESOURCES-MIB
OIDs so it works against any SNMP-enabled device that exposes them.

This only runs for devices that have `snmp_community` set on them (see the
`Device` model) — devices without one just keep getting the ICMP reachability
check from poller.py, same as before.

IMPORTANT — read before pointing this at real network hardware:
HOST-RESOURCES-MIB (used here for CPU/memory) is well-supported by Linux boxes
running net-snmp (including virtual routers like VyOS/pfSense, or any Linux
server), but most enterprise Cisco/Juniper gear does NOT expose it — those use
vendor-specific MIBs instead (e.g. Cisco's CISCO-PROCESS-MIB for CPU). If you
point this at real enterprise hardware and get no cpu/memory values back,
that's why — not a bug. Interface status (up/down count) and uptime, by
contrast, come from MIB-II, which essentially every SNMP-enabled device
(including enterprise routers/switches) supports.

Safe test target with no setup required: demo.pysnmp.com, community 'public',
port 161 — a public SNMP demo agent maintained by the pysnmp project.
"""

import logging

from pysnmp.hlapi.asyncio import (
    SnmpEngine,
    CommunityData,
    UdpTransportTarget,
    ContextData,
    ObjectType,
    ObjectIdentity,
    getCmd,
    bulkCmd,
    isEndOfMib,
)
from pysnmp.proto.rfc1905 import NoSuchObject, NoSuchInstance, EndOfMibView

logger = logging.getLogger("snmp_poller")

OID_SYS_UPTIME = "1.3.6.1.2.1.1.3.0"
OID_HR_PROCESSOR_LOAD = "1.3.6.1.2.1.25.3.3.1.2"   # table: one row per CPU core, % busy
OID_HR_STORAGE_DESCR = "1.3.6.1.2.1.25.2.3.1.3"     # table: human-readable storage unit names
OID_HR_STORAGE_SIZE = "1.3.6.1.2.1.25.2.3.1.5"      # table: total size per storage unit
OID_HR_STORAGE_USED = "1.3.6.1.2.1.25.2.3.1.6"      # table: used size per storage unit
OID_IF_OPER_STATUS = "1.3.6.1.2.1.2.2.1.8"          # table: 1 = up, 2 = down, per interface


async def _get_scalar(ip: str, community: str, oid: str, timeout: int = 2):
    engine = SnmpEngine()
    error_indication, error_status, _error_index, var_binds = await getCmd(
        engine,
        CommunityData(community, mpModel=1),  # SNMPv2c
        UdpTransportTarget((ip, 161), timeout=timeout, retries=1),
        ContextData(),
        ObjectType(ObjectIdentity(oid)),
    )
    if error_indication or error_status:
        return None
    value = var_binds[0][1]
    if isinstance(value, (NoSuchObject, NoSuchInstance, EndOfMibView)):
        return None
    return value


async def _walk_table(ip: str, community: str, base_oid: str, timeout: int = 2, max_rows: int = 64):
    """Walks a MIB table using GETBULK. Returns a list of (oid_string, value) rows."""
    engine = SnmpEngine()
    results = []
    var_binds = [ObjectType(ObjectIdentity(base_oid))]

    for _ in range(max_rows):
        error_indication, error_status, _error_index, var_bind_table = await bulkCmd(
            engine,
            CommunityData(community, mpModel=1),
            UdpTransportTarget((ip, 161), timeout=timeout, retries=1),
            ContextData(),
            0,
            10,
            *var_binds,
        )
        if error_indication or error_status:
            break

        stopped_early = False
        for row in var_bind_table:
            for oid, value in row:
                oid_str = str(oid)
                # Not part of this table anymore, or an empty/no-data response
                # for this OID (agent doesn't support this table at all).
                if (
                    not oid_str.startswith(base_oid + ".")
                    or isinstance(value, (NoSuchObject, NoSuchInstance, EndOfMibView))
                ):
                    stopped_early = True
                    break
                results.append((oid_str, value))
            if stopped_early:
                break

        var_binds = list(var_bind_table[-1])
        if stopped_early or isEndOfMib(var_binds):
            break

    return results


async def poll_snmp_metrics(ip: str, community: str) -> dict:
    """
    Returns metric_type -> value for whatever this device actually exposes.
    Missing/unsupported OIDs are simply omitted (not treated as errors) since
    different hardware supports different subsets of these standard MIBs.
    """
    metrics: dict = {}

    uptime = await _get_scalar(ip, community, OID_SYS_UPTIME)
    if uptime is not None:
        metrics["uptime_ticks"] = float(uptime)

    cpu_rows = await _walk_table(ip, community, OID_HR_PROCESSOR_LOAD)
    if cpu_rows:
        values = []
        for _oid, v in cpu_rows:
            try:
                values.append(float(v))
            except (ValueError, TypeError):
                continue  # skip SNMP's end-of-table marker or any other non-numeric row
        if values:
            metrics["cpu"] = sum(values) / len(values)

    storage_descr = await _walk_table(ip, community, OID_HR_STORAGE_DESCR)
    ram_index = None
    for oid, value in storage_descr:
        text = str(value).lower()
        if "memory" in text or "ram" in text:
            ram_index = oid.split(".")[-1]
            break

    if ram_index:
        size = await _get_scalar(ip, community, f"{OID_HR_STORAGE_SIZE}.{ram_index}")
        used = await _get_scalar(ip, community, f"{OID_HR_STORAGE_USED}.{ram_index}")
        if size and used and float(size) > 0:
            metrics["memory"] = (float(used) / float(size)) * 100

    if_status_rows = await _walk_table(ip, community, OID_IF_OPER_STATUS)
    if if_status_rows:
        up = 0
        total = 0
        for _oid, v in if_status_rows:
            try:
                status_value = int(v)
            except (ValueError, TypeError):
                continue  # skip SNMP's end-of-table marker or any other non-numeric row
            total += 1
            if status_value == 1:
                up += 1
        if total:
            metrics["interfaces_up"] = float(up)
            metrics["interfaces_total"] = float(total)

    return metrics
