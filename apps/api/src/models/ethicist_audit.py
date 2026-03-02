"""Ethicist immutable audit log — cryptographic_signature, immutable_log_reference."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class EthicistAuditLog(Base):
    """
    Immutable audit log for Ethicist assessments.

    - cryptographic_signature: hash of payload (chain with prev_hash for integrity)
    - immutable_log_reference: optional IPFS CID or blockchain tx ref when anchored
    """
    __tablename__ = "ethicist_audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    decision_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    prev_hash: Mapped[Optional[str]] = mapped_column(String(64))
    cryptographic_signature: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    immutable_log_reference: Mapped[Optional[str]] = mapped_column(String(256))  # e.g. ipfs:Qm..., chain:txid
    source_module: Mapped[Optional[str]] = mapped_column(String(64))
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
