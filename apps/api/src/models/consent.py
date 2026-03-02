"""User consent model for GDPR Article 7."""
from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class UserConsent(Base):
    """User consent: purpose, scope, granted_at, withdrawn_at (GDPR Art. 7)."""
    __tablename__ = "user_consents"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    scope: Mapped[str] = mapped_column(String(256), nullable=False)
    version: Mapped[str] = mapped_column(String(32), default="1.0")
    granted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(512))
    policy_version: Mapped[str | None] = mapped_column(String(64))

    @property
    def is_active(self) -> bool:
        return self.withdrawn_at is None
