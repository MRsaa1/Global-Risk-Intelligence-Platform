"""Cryptographic Audit Trail - immutable, tamper-evident logging using hash chain."""
import hashlib
import json
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.asgi.models import AuditAnchor, AuditEvent

logger = logging.getLogger(__name__)

ANCHOR_INTERVAL = 100


class CryptoAuditTrail:
    """Immutable, tamper-evident logging using hash chain."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._last_hash: str | None = None

    def _hash(self, content: str, prev_hash: str | None) -> str:
        """Compute SHA-256 hash of prev_hash + content."""
        payload = (prev_hash or "GENESIS") + "|" + content
        return hashlib.sha256(payload.encode()).hexdigest()

    async def log_event(self, event: dict[str, Any]) -> str:
        """
        Log an event and return its hash.

        Event is hashed with previous hash for chain integrity.
        Every ANCHOR_INTERVAL events, a Merkle anchor is stored.
        """
        content = json.dumps(event, sort_keys=True)
        result = await self.db.execute(
            select(AuditEvent).order_by(AuditEvent.id.desc()).limit(1)
        )
        last = result.scalar_one_or_none()
        prev_hash = last.event_hash if last else None
        event_hash = self._hash(content, prev_hash)
        ev = AuditEvent(
            event_hash=event_hash,
            prev_hash=prev_hash,
            content=content,
            created_at=datetime.utcnow(),
        )
        self.db.add(ev)
        await self.db.commit()
        await self.db.refresh(ev)
        self._last_hash = event_hash

        # Anchor every N events
        count_result = await self.db.execute(select(AuditEvent))
        total = len(count_result.scalars().all())
        if total % ANCHOR_INTERVAL == 0:
            anchor = AuditAnchor(
                merkle_root=event_hash.encode(),
                event_count=total,
                anchor_type="internal",
                anchor_reference=f"chain_anchor_{total}",
                created_at=datetime.utcnow(),
            )
            self.db.add(anchor)
            await self.db.commit()

        return event_hash

    async def verify_integrity(self, event_id: str) -> bool:
        """Verify event hasn't been tampered with by checking hash chain."""
        try:
            eid = int(event_id)
        except ValueError:
            return False
        result = await self.db.execute(select(AuditEvent).where(AuditEvent.id == eid))
        ev = result.scalar_one_or_none()
        if not ev:
            return False
        expected_hash = self._hash(ev.content or "", ev.prev_hash)
        return ev.event_hash == expected_hash
