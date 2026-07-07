from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.user import User

router = APIRouter(prefix="/audit-log", tags=["audit"])


@router.get("")
async def list_audit_log(
    actor: str | None = None,
    action: str | None = None,
    since: datetime | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = select(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        query = query.where(AuditLog.action == action)
    if since:
        query = query.where(AuditLog.created_at >= since)
    query = query.limit(limit)

    result = await db.execute(query)
    return result.scalars().all()
