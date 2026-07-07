import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    device_type: Mapped[str] = mapped_column(String(20), nullable=False)  # router | switch | access_point
    vendor: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # SNMP (community string should be encrypted before storage in real deployments)
    snmp_community: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # SSH (store only a reference to a secret, never the raw credential)
    ssh_username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ssh_credential_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)

    poll_interval_seconds: Mapped[int] = mapped_column(Integer, default=30)
    status: Mapped[str] = mapped_column(String(20), default="unknown")  # online|degraded|offline|unknown

    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    interfaces = relationship("Interface", back_populates="device", cascade="all, delete-orphan")
