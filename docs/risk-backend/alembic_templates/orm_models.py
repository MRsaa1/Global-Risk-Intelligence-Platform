"""
SQLAlchemy ORM models for canonical risk events (template for 1:1 backend).

Use with 6-step Alembic package: event_entities use UUID PK; event_entity_links
links entity to (source_name, source_record_id). For SQLite use String(36) for event_uid
and omit EventEntityLink if not using that table.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import Date, DateTime, Float, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class SourceRegistry(Base):
    __tablename__ = "source_registry"

    source_name: Mapped[str] = mapped_column(Text, primary_key=True)
    domain: Mapped[str] = mapped_column(Text, nullable=False)
    license_type: Mapped[Optional[str]] = mapped_column(Text)
    refresh_frequency: Mapped[str] = mapped_column(Text, nullable=False)
    priority_rank: Mapped[int] = mapped_column(nullable=False)
    active: Mapped[bool] = mapped_column(nullable=False, default=True)
    tos_url: Mapped[Optional[str]] = mapped_column(Text)
    storage_restrictions: Mapped[Optional[str]] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ProcessingRun(Base):
    __tablename__ = "processing_runs"

    run_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source_name: Mapped[str] = mapped_column(Text, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(Text, nullable=False)
    dataset_version: Mapped[str] = mapped_column(Text, nullable=False)
    row_count: Mapped[int] = mapped_column(default=0)
    error_count: Mapped[int] = mapped_column(default=0)
    config_snapshot: Mapped[Optional[dict]] = mapped_column(JSONB)


class RawSourceRecord(Base):
    __tablename__ = "raw_source_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_name: Mapped[str] = mapped_column(Text, nullable=False)
    source_record_id: Mapped[str] = mapped_column(Text, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    checksum: Mapped[str] = mapped_column(Text, nullable=False)


class NormalizedEvent(Base):
    __tablename__ = "normalized_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_name: Mapped[str] = mapped_column(Text, nullable=False)
    source_record_id: Mapped[str] = mapped_column(Text, nullable=False)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    event_subtype: Mapped[Optional[str]] = mapped_column(Text)
    title: Mapped[Optional[str]] = mapped_column(Text)
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    country_iso2: Mapped[Optional[str]] = mapped_column(String(2))
    region: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(Text)
    lat: Mapped[Optional[float]] = mapped_column(Float)
    lon: Mapped[Optional[float]] = mapped_column(Float)
    geo_precision: Mapped[Optional[str]] = mapped_column(Text)
    fatalities: Mapped[Optional[Decimal]] = mapped_column(Numeric)
    affected: Mapped[Optional[Decimal]] = mapped_column(Numeric)
    confidence: Mapped[Decimal] = mapped_column(Numeric, nullable=False, default=Decimal("0.7"))
    inserted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class EventEntity(Base):
    __tablename__ = "event_entities"

    event_uid: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    canonical_event_type: Mapped[str] = mapped_column(Text, nullable=False)
    canonical_title: Mapped[Optional[str]] = mapped_column(Text)
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    country_iso2: Mapped[Optional[str]] = mapped_column(String(2))
    region: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(Text)
    lat: Mapped[Optional[float]] = mapped_column(Float)
    lon: Mapped[Optional[float]] = mapped_column(Float)
    best_source: Mapped[str] = mapped_column(Text, nullable=False)
    source_count: Mapped[int] = mapped_column(nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    links: Mapped[list[EventEntityLink]] = relationship("EventEntityLink", back_populates="entity", cascade="all, delete-orphan")
    losses: Mapped[list[EventLoss]] = relationship("EventLoss", back_populates="entity", cascade="all, delete-orphan")
    impacts: Mapped[list[EventImpact]] = relationship("EventImpact", back_populates="entity", cascade="all, delete-orphan")
    recoveries: Mapped[list[EventRecovery]] = relationship("EventRecovery", back_populates="entity", cascade="all, delete-orphan")


class EventEntityLink(Base):
    __tablename__ = "event_entity_links"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_uid: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("event_entities.event_uid"), nullable=False)
    source_name: Mapped[str] = mapped_column(Text, nullable=False)
    source_record_id: Mapped[str] = mapped_column(Text, nullable=False)

    entity: Mapped[EventEntity] = relationship("EventEntity", back_populates="links")


class EventLoss(Base):
    __tablename__ = "event_losses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_uid: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("event_entities.event_uid"), nullable=False)
    loss_type: Mapped[str] = mapped_column(Text, nullable=False)
    amount_original: Mapped[Optional[Decimal]] = mapped_column(Numeric)
    currency_original: Mapped[Optional[str]] = mapped_column(String(3))
    amount_usd_nominal: Mapped[Optional[Decimal]] = mapped_column(Numeric)
    amount_usd_real: Mapped[Optional[Decimal]] = mapped_column(Numeric)
    base_year: Mapped[int] = mapped_column(nullable=False)
    source_name: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[Decimal] = mapped_column(Numeric, nullable=False, default=Decimal("0.7"))

    entity: Mapped[EventEntity] = relationship("EventEntity", back_populates="losses")


class EventImpact(Base):
    __tablename__ = "event_impacts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_uid: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("event_entities.event_uid"), nullable=False)
    casualties: Mapped[Optional[Decimal]] = mapped_column(Numeric)
    displaced: Mapped[Optional[Decimal]] = mapped_column(Numeric)
    infra_damage_score: Mapped[Optional[Decimal]] = mapped_column(Numeric)
    sector: Mapped[Optional[str]] = mapped_column(Text)
    source_name: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[Decimal] = mapped_column(Numeric, nullable=False, default=Decimal("0.7"))

    entity: Mapped[EventEntity] = relationship("EventEntity", back_populates="impacts")


class EventRecovery(Base):
    __tablename__ = "event_recovery"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_uid: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("event_entities.event_uid"), nullable=False)
    duration_days: Mapped[Optional[Decimal]] = mapped_column(Numeric)
    recovery_time_months: Mapped[Optional[Decimal]] = mapped_column(Numeric)
    rto_days: Mapped[Optional[Decimal]] = mapped_column(Numeric)
    rpo_hours: Mapped[Optional[Decimal]] = mapped_column(Numeric)
    source_name: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[Decimal] = mapped_column(Numeric, nullable=False, default=Decimal("0.7"))

    entity: Mapped[EventEntity] = relationship("EventEntity", back_populates="recoveries")


class DataQualityScore(Base):
    __tablename__ = "data_quality_scores"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[str] = mapped_column(Text, nullable=False)
    q_score: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False)
    completeness: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))
    source_trust: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))
    freshness: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))
    consistency: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FxRate(Base):
    __tablename__ = "fx_rates"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    currency_from: Mapped[str] = mapped_column(String(3), nullable=False)
    currency_to: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    rate: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    as_of_date: Mapped[date] = mapped_column(nullable=False)
    source: Mapped[Optional[str]] = mapped_column(Text)


class CpiIndex(Base):
    __tablename__ = "cpi_index"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    country_iso2: Mapped[str] = mapped_column(String(2), nullable=False)
    year: Mapped[int] = mapped_column(nullable=False)
    index_value: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    base_year: Mapped[Optional[int]] = mapped_column(nullable=True)
