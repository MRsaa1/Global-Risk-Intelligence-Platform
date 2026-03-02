"""Municipal onboarding request — Track B: municipalities 5K–50K signing up."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class MunicipalOnboardingRequest(Base):
    """
    Onboarding request from a municipality (Track B: small cities 5K–50K).
    status: pending, in_review, onboarded, declined.
    """
    __tablename__ = "municipal_onboarding_requests"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    municipality_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    population: Mapped[int | None] = mapped_column(Integer, nullable=True)
    country_code: Mapped[str | None] = mapped_column(String(2), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        index=True,
    )
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, onupdate=datetime.utcnow)
