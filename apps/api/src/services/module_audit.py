"""Log strategic module actions to unified audit table for regulator export."""
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.module_audit_log import ModuleAuditLog


async def log_module_action(
    db: AsyncSession,
    module_id: str,
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    changed_by: Optional[str] = None,
) -> None:
    """Write one audit entry for a strategic module action."""
    entry = ModuleAuditLog(
        id=str(uuid4()),
        module_id=module_id.lower().strip(),
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        changed_at=datetime.utcnow(),
        changed_by=changed_by,
    )
    db.add(entry)
    await db.flush()
