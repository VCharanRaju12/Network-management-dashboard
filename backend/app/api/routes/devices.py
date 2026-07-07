import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.device import Device
from app.models.metric import Metric
from app.models.user import User
from app.schemas.device import DeviceCreate, DeviceOut, DeviceUpdate, MetricOut
from app.services.audit_logger import log_action

router = APIRouter(prefix="/devices", tags=["devices"])


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
    device = Device(**payload.model_dump(), created_by=current_user.id)
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
    for field, value in changes.items():
        setattr(device, field, value)

    await db.commit()
    await db.refresh(device)
    await log_action(db, current_user.id, "device.updated", "device", device.id, changes)
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
