import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class DeviceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    ip_address: str
    device_type: str = Field(pattern="^(router|switch|access_point)$")
    vendor: str | None = None
    snmp_community: str | None = None
    ssh_username: str | None = None
    ssh_credential_ref: str | None = None
    poll_interval_seconds: int = 30


class DeviceUpdate(BaseModel):
    name: str | None = None
    vendor: str | None = None
    snmp_community: str | None = None
    ssh_username: str | None = None
    ssh_credential_ref: str | None = None
    poll_interval_seconds: int | None = None


class DeviceOut(BaseModel):
    id: uuid.UUID
    name: str
    ip_address: str
    device_type: str
    vendor: str | None
    status: str
    poll_interval_seconds: int
    created_at: datetime

    class Config:
        from_attributes = True


class MetricOut(BaseModel):
    metric_type: str
    value: float
    recorded_at: datetime

    class Config:
        from_attributes = True


class InterfaceOut(BaseModel):
    id: uuid.UUID
    if_name: str
    if_index: int | None
    is_up: bool
    speed_mbps: int | None

    class Config:
        from_attributes = True
