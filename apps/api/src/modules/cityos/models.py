"""CityOS module database models."""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class CityTwin(Base):
    """City-level digital twin for CityOS."""
    __tablename__ = "cityos_city_twins"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    cityos_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    region: Mapped[Optional[str]] = mapped_column(String(100))
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    population: Mapped[Optional[int]] = mapped_column(Integer)
    description: Mapped[Optional[str]] = mapped_column(Text)
    capacity_notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)


class MigrationRoute(Base):
    """Migration route between population centers (CityOS / CMDP subdomain)."""
    __tablename__ = "cityos_migration_routes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    cityos_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    origin_city_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("cityos_city_twins.id", ondelete="SET NULL"), index=True
    )
    destination_city_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("cityos_city_twins.id", ondelete="SET NULL"), index=True
    )
    estimated_flow_per_year: Mapped[Optional[int]] = mapped_column(Integer)
    driver_type: Mapped[Optional[str]] = mapped_column(String(50))  # climate, conflict, economic
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)
