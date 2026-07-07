import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog


async def log_action(
    db: AsyncSession,
    actor_id: uuid.UUID | None,
    action: str,
    target_type: str | None = None,
    target_id: uuid.UUID | None = None,
    details: dict | None = None,
) -> None:
    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
    )
    db.add(entry)
    await db.commit()
