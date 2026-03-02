"""
Ethicist immutable audit — hash chain, cryptographic_signature, immutable_log_reference.

Each Ethicist assessment is logged with:
- prev_hash (previous record's cryptographic_signature for chain integrity)
- cryptographic_signature = SHA-256(prev_hash + payload_hash)
- payload_hash = SHA-256(canonical JSON of assessment)
- immutable_log_reference: optional IPFS CID or blockchain tx (placeholder "pending" until integrated)
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.ethicist_audit import EthicistAuditLog

logger = logging.getLogger(__name__)


def _hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


def _canonical_payload(payload: Dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, default=str)


async def log_ethicist_assessment(
    db: AsyncSession,
    decision_id: str,
    assessment: Dict[str, Any],
    source_module: str = "",
) -> Dict[str, Any]:
    """
    Append an Ethicist assessment to the immutable audit log.

    Returns dict with cryptographic_signature, payload_hash, immutable_log_reference.
    """
    payload_str = _canonical_payload(assessment)
    payload_hash = _hash(payload_str)

    result = await db.execute(
        select(EthicistAuditLog).order_by(EthicistAuditLog.id.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    prev_hash = last.cryptographic_signature if last else None
    chain_input = (prev_hash or "GENESIS") + "|" + payload_hash
    cryptographic_signature = _hash(chain_input)

    # Placeholder until IPFS/blockchain integration
    immutable_log_reference = "pending"

    record = EthicistAuditLog(
        decision_id=decision_id,
        prev_hash=prev_hash,
        cryptographic_signature=cryptographic_signature,
        payload_hash=payload_hash,
        payload=payload_str,
        immutable_log_reference=immutable_log_reference,
        source_module=source_module or None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return {
        "cryptographic_signature": cryptographic_signature,
        "payload_hash": payload_hash,
        "prev_hash": prev_hash,
        "immutable_log_reference": immutable_log_reference,
        "audit_id": record.id,
    }


async def verify_ethicist_audit_chain(db: AsyncSession, limit: int = 100) -> bool:
    """Verify hash chain integrity of the last `limit` records."""
    result = await db.execute(
        select(EthicistAuditLog).order_by(EthicistAuditLog.id.asc())
    )
    rows = result.scalars().all()
    rows = rows[-limit:] if len(rows) > limit else rows
    prev = None
    for r in rows:
        expected = _hash((prev or "GENESIS") + "|" + r.payload_hash)
        if r.cryptographic_signature != expected:
            return False
        prev = r.cryptographic_signature
    return True
