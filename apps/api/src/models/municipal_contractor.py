"""Municipal contractor — Track B: contractors linked to municipality/tenant."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class MunicipalContractor(Base):
    """
    Contractor linked to a municipality (tenant) for Track B deployments.
    contractor_type: e.g. engineering, green_infrastructure, consulting.
    """
    __tablename__ = "municipal_contractors"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    tenant_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contractor_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    contact_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        default="active",
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, onupdate=datetime.utcnow)
