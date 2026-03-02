"""Agent message bus log for audit (optional persistence by correlation_id)."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class AgentMessageLog(Base):
    """
    Optional persistence of AgentMessageBus messages when use_message_bus_persistence is True.
    Enables audit and debugging by correlation_id (workflow run id).
    """
    __tablename__ = "agent_message_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    message_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    correlation_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    sender: Mapped[str] = mapped_column(String(64), nullable=False)
    recipient: Mapped[str] = mapped_column(String(64), nullable=False)
    message_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_summary: Mapped[Optional[str]] = mapped_column(Text)
    timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    replied: Mapped[bool] = mapped_column(default=False)
