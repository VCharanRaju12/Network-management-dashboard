import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Interface(Base):
    __tablename__ = "interfaces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"))
    if_name: Mapped[str] = mapped_column(String(50), nullable=False)
    if_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_up: Mapped[bool] = mapped_column(Boolean, default=True)
    speed_mbps: Mapped[int | None] = mapped_column(Integer, nullable=True)

    device = relationship("Device", back_populates="interfaces")
