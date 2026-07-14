import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_admin
from app.core.security import encrypt_secret
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.device import Device
from app.models.interface import Interface
from app.models.metric import Metric
from app.models.user import User
from app.schemas.device import DeviceCreate, DeviceOut, DeviceUpdate, InterfaceOut, MetricOut
from app.services.audit_logger import log_action

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("/events/recent")
async def recent_device_events(
    limit: int = 30,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Read-only feed of device status transitions (online/offline), for the
    dashboard's live activity feed. Deliberately separate from the full
    /api/audit-log (which stays admin-only, since it also covers sensitive
    user-management actions) — this one is safe for viewers to see too.
    """
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.action == "device.status_changed")
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    entries = result.scalars().all()
    return [
        {
            "id": e.id,
            "device_id": str(e.target_id) if e.target_id else None,
            "device_name": (e.details or {}).get("device_name"),
            "from_status": (e.details or {}).get("from"),
            "to_status": (e.details or {}).get("to"),
            "created_at": e.created_at,
        }
        for e in entries
    ]


@router.get("", response_model=list[DeviceOut])
async def list_devices(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Device).order_by(Device.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=DeviceOut, status_code=201)
async def create_device(
    payload: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    device_data = payload.model_dump()
    if device_data.get("snmp_community"):
        device_data["snmp_community"] = encrypt_secret(device_data["snmp_community"])

    device = Device(**device_data, created_by=current_user.id)
    db.add(device)
    await db.commit()
    await db.refresh(device)
    await log_action(db, current_user.id, "device.created", "device", device.id, {"name": device.name})
    return device


@router.get("/{device_id}", response_model=DeviceOut)
async def get_device(device_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.patch("/{device_id}", response_model=DeviceOut)
async def update_device(
    device_id: uuid.UUID,
    payload: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    changes = payload.model_dump(exclude_unset=True)
    if "snmp_community" in changes and changes["snmp_community"]:
        changes["snmp_community"] = encrypt_secret(changes["snmp_community"])

    for field, value in changes.items():
        setattr(device, field, value)

    await db.commit()
    await db.refresh(device)

    # Redact the credential from the audit trail itself — encrypting it in
    # the devices table but then writing the plaintext into audit_log.details
    # would defeat the point entirely.
    audit_changes = {**changes}
    if "snmp_community" in audit_changes:
        audit_changes["snmp_community"] = "***"

    await log_action(db, current_user.id, "device.updated", "device", device.id, audit_changes)
    return device


@router.delete("/{device_id}", status_code=204)
async def delete_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    await db.delete(device)
    await db.commit()
    await log_action(db, current_user.id, "device.deleted", "device", device_id)


@router.get("/{device_id}/metrics", response_model=list[MetricOut])
async def get_device_metrics(
    device_id: uuid.UUID,
    metric_type: str | None = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Metric).where(Metric.device_id == device_id)
    if metric_type:
        query = query.where(Metric.metric_type == metric_type)
    query = query.order_by(Metric.recorded_at.desc()).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{device_id}/interfaces", response_model=list[InterfaceOut])
async def get_device_interfaces(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Interface).where(Interface.device_id == device_id).order_by(Interface.if_index)
    )
    return result.scalars().all()
