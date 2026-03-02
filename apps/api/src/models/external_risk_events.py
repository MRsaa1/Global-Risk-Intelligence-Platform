"""Canonical external risk event models (Technical Spec v1).

Tables: raw_source_records, normalized_events, event_entities, event_losses,
event_impacts, event_recovery, source_registry, fx_rates, cpi_index,
processing_runs, data_quality_scores.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class RawSourceRecord(Base):
    """Raw API/file payloads before normalization."""
    __tablename__ = "raw_source_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_record_id: Mapped[str] = mapped_column(String(512), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)


class NormalizedEvent(Base):
    """Single contract event before dedup (source_name + source_record_id unique)."""
    __tablename__ = "normalized_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_record_id: Mapped[str] = mapped_column(String(512), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    event_subtype: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    country_iso2: Mapped[Optional[str]] = mapped_column(String(2), nullable=True, index=True)
    region: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lon: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    geo_precision: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    fatalities: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    affected: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    confidence: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False, default=Decimal("0.7"))
    inserted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class EventEntity(Base):
    """Deduped event entity (source of truth per event)."""
    __tablename__ = "event_entities"

    event_uid: Mapped[str] = mapped_column(String(36), primary_key=True)
    canonical_event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    canonical_title: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    country_iso2: Mapped[Optional[str]] = mapped_column(String(2), nullable=True, index=True)
    region: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lon: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    best_source: Mapped[str] = mapped_column(String(64), nullable=False)
    source_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    source_record_id: Mapped[Optional[str]] = mapped_column(String(512), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    losses: Mapped[list["EventLoss"]] = relationship("EventLoss", back_populates="entity", cascade="all, delete-orphan")
    impacts: Mapped[list["EventImpact"]] = relationship("EventImpact", back_populates="entity", cascade="all, delete-orphan")
    recoveries: Mapped[list["EventRecovery"]] = relationship("EventRecovery", back_populates="entity", cascade="all, delete-orphan")


class EventLoss(Base):
    """Economic/insured loss per event (with currency normalization)."""
    __tablename__ = "event_losses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_uid: Mapped[str] = mapped_column(String(36), ForeignKey("event_entities.event_uid"), nullable=False, index=True)
    loss_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    amount_original: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 2), nullable=True)
    currency_original: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    amount_usd_nominal: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 2), nullable=True)
    amount_usd_real: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 2), nullable=True)
    base_year: Mapped[int] = mapped_column(Integer, nullable=False)
    source_name: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False, default=Decimal("0.7"))

    entity: Mapped["EventEntity"] = relationship("EventEntity", back_populates="losses")


class EventImpact(Base):
    """Casualties, displaced, sector impact per event."""
    __tablename__ = "event_impacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_uid: Mapped[str] = mapped_column(String(36), ForeignKey("event_entities.event_uid"), nullable=False, index=True)
    casualties: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    displaced: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    infra_damage_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    sector: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    source_name: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False, default=Decimal("0.7"))

    entity: Mapped["EventEntity"] = relationship("EventEntity", back_populates="impacts")


class EventRecovery(Base):
    """Recovery time, RTO/RPO per event."""
    __tablename__ = "event_recovery"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_uid: Mapped[str] = mapped_column(String(36), ForeignKey("event_entities.event_uid"), nullable=False, index=True)
    duration_days: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    recovery_time_months: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    rto_days: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    rpo_hours: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    source_name: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False, default=Decimal("0.7"))

    entity: Mapped["EventEntity"] = relationship("EventEntity", back_populates="recoveries")


class SourceRegistry(Base):
    """Data source catalog: domain, license, priority, refresh."""
    __tablename__ = "source_registry"

    source_name: Mapped[str] = mapped_column(String(64), primary_key=True)
    domain: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    license_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    refresh_frequency: Mapped[str] = mapped_column(String(32), nullable=False)
    priority_rank: Mapped[int] = mapped_column(Integer, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    tos_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    storage_restrictions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class FxRate(Base):
    """FX rates for currency normalization."""
    __tablename__ = "fx_rates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    currency_from: Mapped[str] = mapped_column(String(3), nullable=False)
    currency_to: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    rate: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class CpiIndex(Base):
    """CPI index for real-USD normalization."""
    __tablename__ = "cpi_index"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    country_iso2: Mapped[str] = mapped_column(String(2), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    index_value: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    base_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)


class ProcessingRun(Base):
    """ETL run versioning for reproducibility."""
    __tablename__ = "processing_runs"

    run_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    dataset_version: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    row_count: Mapped[int] = mapped_column(Integer, nullable=True, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=True, default=0)
    config_snapshot: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class DataQualityScore(Base):
    """Q score per entity (event_entity, event_loss, ...)."""
    __tablename__ = "data_quality_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(128), nullable=False)
    q_score: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False)
    completeness: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2), nullable=True)
    source_trust: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2), nullable=True)
    freshness: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2), nullable=True)
    consistency: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2), nullable=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
