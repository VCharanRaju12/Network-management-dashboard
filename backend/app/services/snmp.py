"""
Thin async wrappers around pysnmp's low-level GET/GETNEXT calls.

SNMP concepts, briefly:
- An OID (e.g. "1.3.6.1.2.1.1.3.0") is a fixed numeric address for one piece
  of data on a device — the same OID means the same thing on every vendor's
  gear, by international standard.
- GET fetches the value at one exact OID.
- WALK fetches an entire branch (e.g. "every interface's description") by
  repeatedly asking "what comes after this OID?" until we leave that branch.
"""

from pysnmp.hlapi.asyncio import (
    CommunityData,
    ContextData,
    ObjectIdentity,
    ObjectType,
    SnmpEngine,
    UdpTransportTarget,
    getCmd,
    nextCmd,
)


class SnmpError(Exception):
    pass


async def snmp_get(ip: str, community: str, oid: str, port: int = 161, timeout: float = 2.0) -> str:
    """Fetch a single OID's value. Raises SnmpError on failure/timeout."""
    engine = SnmpEngine()
    error_indication, error_status, error_index, var_binds = await getCmd(
        engine,
        CommunityData(community, mpModel=1),  # mpModel=1 -> SNMPv2c
        UdpTransportTarget((ip, port), timeout=timeout, retries=1),
        ContextData(),
        ObjectType(ObjectIdentity(oid)),
    )

    if error_indication:
        raise SnmpError(str(error_indication))
    if error_status:
        raise SnmpError(f"{error_status.prettyPrint()} at {error_index}")

    for name, value in var_binds:
        return str(value)
    raise SnmpError("No value returned")


async def snmp_walk(
    ip: str, community: str, base_oid: str, port: int = 161, timeout: float = 2.0, max_rows: int = 200
) -> list[tuple[str, str]]:
    """
    Walk every OID under base_oid, returning [(oid_string, value_string), ...].
    Stops when the response leaves the base_oid branch, hits max_rows, or errors.
    """
    engine = SnmpEngine()
    auth = CommunityData(community, mpModel=1)
    target = UdpTransportTarget((ip, port), timeout=timeout, retries=1)
    context = ContextData()

    results: list[tuple[str, str]] = []
    current = ObjectType(ObjectIdentity(base_oid))

    for _ in range(max_rows):
        error_indication, error_status, error_index, var_binds = await nextCmd(
            engine, auth, target, context, current
        )

        if error_indication:
            raise SnmpError(str(error_indication))
        if error_status:
            raise SnmpError(f"{error_status.prettyPrint()} at {error_index}")

        name, value = var_binds[0]
        oid_str = str(name)

        if not oid_str.startswith(base_oid):
            break  # walked past the branch we care about

        results.append((oid_str, str(value)))
        current = ObjectType(ObjectIdentity(oid_str))

    return results
