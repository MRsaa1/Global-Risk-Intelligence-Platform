"""
Dataclasses for ETL contracts (normalize -> entity, quality scoring).

Use in pipeline: NormalizedEventDTO from raw payloads, QualityScoreDTO for Q formula.
"""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID


@dataclass(slots=True)
class NormalizedEventDTO:
    source_name: str
    source_record_id: str
    event_type: str
    event_subtype: Optional[str]
    title: Optional[str]
    start_date: Optional[date]
    end_date: Optional[date]
    country_iso2: Optional[str]
    region: Optional[str]
    city: Optional[str]
    lat: Optional[float]
    lon: Optional[float]
    geo_precision: Optional[str]
    fatalities: Optional[Decimal]
    affected: Optional[Decimal]
    confidence: Decimal


@dataclass(slots=True)
class QualityScoreDTO:
    event_uid: UUID
    completeness: Decimal
    source_trust: Decimal
    freshness: Decimal
    consistency: Decimal
    q_score: Decimal


@dataclass(slots=True)
class EventLossDTO:
    event_uid: UUID
    loss_type: str
    amount_original: Optional[Decimal]
    currency_original: Optional[str]
    amount_usd_nominal: Optional[Decimal]
    amount_usd_real: Optional[Decimal]
    base_year: int
    source_name: str
    confidence: Decimal


@dataclass(slots=True)
class EventImpactDTO:
    event_uid: UUID
    casualties: Optional[Decimal]
    displaced: Optional[Decimal]
    infra_damage_score: Optional[Decimal]
    sector: Optional[str]
    source_name: str
    confidence: Decimal


@dataclass(slots=True)
class EventRecoveryDTO:
    event_uid: UUID
    duration_days: Optional[Decimal]
    recovery_time_months: Optional[Decimal]
    rto_days: Optional[Decimal]
    rpo_hours: Optional[Decimal]
    source_name: str
    confidence: Decimal
