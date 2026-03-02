"""
External Risk ETL Pipeline: extract → normalize → event_entities.

Pulls from USGS, NOAA (and stub EM-DAT), writes to raw_source_records,
normalized_events, and event_entities. Used for correct online risk calculation
and backtesting.

Technical Spec: docs/EXTERNAL_DATABASES_TECHNICAL_SPEC_V1.md
"""
import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import AsyncSessionLocal
from src.models.external_risk_events import (
    RawSourceRecord,
    NormalizedEvent,
    EventEntity,
    EventLoss,
    EventImpact,
    EventRecovery,
    ProcessingRun,
    DataQualityScore,
    SourceRegistry,
)
from src.services.external.usgs_client import usgs_client
from src.services.external.noaa_client import get_noaa_client
from src.services.emdat_csv_adapter import (
    parse_emdat_csv,
    normalized_event_from_emdat_payload,
    event_losses_impacts_recovery_from_emdat_payload,
)

logger = logging.getLogger(__name__)

DATASET_VERSION_BASE = "v1"
BASE_YEAR = 2025


def _checksum(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:64]


async def extract_usgs(session: AsyncSession, days: int = 365, min_magnitude: float = 5.0) -> int:
    """Fetch USGS significant earthquakes, write to raw_source_records. Returns count inserted."""
    run_id = str(uuid4())
    run = ProcessingRun(
        run_id=run_id,
        source_name="usgs",
        started_at=datetime.now(timezone.utc),
        status="running",
        dataset_version=f"{DATASET_VERSION_BASE}-usgs-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}",
    )
    session.add(run)
    await session.flush()
    inserted = 0
    try:
        events = await usgs_client.get_earthquake_zones_global(days=days, min_magnitude=min_magnitude)
        for ev in events:
            payload = {
                "id": ev.get("id"),
                "lat": ev.get("lat"),
                "lng": ev.get("lng"),
                "magnitude": ev.get("magnitude"),
                "place": ev.get("place"),
                "depth": ev.get("depth"),
                "time": ev.get("time").isoformat() if ev.get("time") else None,
            }
            rid = ev.get("id") or str(uuid4())
            checksum = _checksum(payload)
            raw = RawSourceRecord(
                source_name="usgs",
                source_record_id=str(rid),
                fetched_at=datetime.now(timezone.utc),
                payload=payload,
                checksum=checksum,
            )
            try:
                session.add(raw)
                await session.flush()
                inserted += 1
            except Exception as e:
                if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                    pass
                else:
                    raise
        run.row_count = inserted
        run.status = "success"
        run.finished_at = datetime.now(timezone.utc)
        logger.info(f"USGS extract: {inserted} raw records")
        return inserted
    except Exception as e:
        run.status = "failed"
        run.finished_at = datetime.now(timezone.utc)
        run.error_count = (run.error_count or 0) + 1
        logger.exception(f"USGS extract failed: {e}")
        raise


def _normalize_usgs_payload(payload: dict) -> Dict[str, Any]:
    """Map USGS raw payload to normalized_events fields."""
    t = payload.get("time")
    start_date = None
    if t:
        try:
            if isinstance(t, str):
                start_date = datetime.fromisoformat(t.replace("Z", "+00:00")).date()
            elif hasattr(t, "date"):
                start_date = t.date()
        except Exception:
            pass
    mag = payload.get("magnitude")
    severity = min(1.0, max(0, (mag - 4.0) / 4.0)) if mag else 0.5
    return {
        "event_type": "seismic",
        "event_subtype": "earthquake",
        "title": f"Earthquake M{mag or 0:.1f} - {payload.get('place') or 'Unknown'}",
        "start_date": start_date,
        "end_date": start_date,
        "lat": payload.get("lat"),
        "lon": payload.get("lng"),
        "geo_precision": "point",
        "fatalities": None,
        "affected": None,
        "confidence": Decimal("0.85"),
    }


async def normalize_source(session: AsyncSession, source_name: str) -> int:
    """Read raw_source_records for source_name, insert into normalized_events (skip existing). Returns count."""
    result = await session.execute(
        select(RawSourceRecord).where(RawSourceRecord.source_name == source_name).order_by(RawSourceRecord.id)
    )
    raws = result.scalars().all()
    existing = await session.execute(
        select(NormalizedEvent.source_record_id).where(NormalizedEvent.source_name == source_name)
    )
    existing_ids = {r[0] for r in existing.fetchall()}
    inserted = 0

    if source_name == "usgs":
        for raw in raws:
            if raw.source_record_id in existing_ids:
                continue
            try:
                norm = _normalize_usgs_payload(raw.payload)
                rec = NormalizedEvent(
                    source_name=raw.source_name,
                    source_record_id=raw.source_record_id,
                    event_type=norm["event_type"],
                    event_subtype=norm.get("event_subtype"),
                    title=norm.get("title"),
                    start_date=norm.get("start_date"),
                    end_date=norm.get("end_date"),
                    lat=norm.get("lat"),
                    lon=norm.get("lon"),
                    geo_precision=norm.get("geo_precision"),
                    fatalities=norm.get("fatalities"),
                    affected=norm.get("affected"),
                    confidence=norm.get("confidence", Decimal("0.7")),
                )
                session.add(rec)
                await session.flush()
                existing_ids.add(raw.source_record_id)
                inserted += 1
            except Exception as e:
                if "unique" not in str(e).lower() and "duplicate" not in str(e).lower():
                    logger.warning(f"Skip normalize raw id={raw.id}: {e}")
    elif source_name == "emdat":
        for raw in raws:
            if raw.source_record_id in existing_ids:
                continue
            try:
                norm = normalized_event_from_emdat_payload(raw.payload)
                rec = NormalizedEvent(
                    source_name=raw.source_name,
                    source_record_id=raw.source_record_id,
                    event_type=norm["event_type"],
                    event_subtype=norm.get("event_subtype"),
                    title=norm.get("title"),
                    start_date=norm.get("start_date"),
                    end_date=norm.get("end_date"),
                    country_iso2=norm.get("country_iso2"),
                    region=norm.get("region"),
                    city=norm.get("city"),
                    lat=norm.get("lat"),
                    lon=norm.get("lon"),
                    geo_precision=norm.get("geo_precision"),
                    fatalities=norm.get("fatalities"),
                    affected=norm.get("affected"),
                    confidence=norm.get("confidence", Decimal("0.75")),
                )
                session.add(rec)
                await session.flush()
                existing_ids.add(raw.source_record_id)
                inserted += 1
            except Exception as e:
                if "unique" not in str(e).lower() and "duplicate" not in str(e).lower():
                    logger.warning(f"Skip normalize emdat raw id={raw.id}: {e}")
    else:
        logger.warning(f"Normalize not implemented for source={source_name}")
    logger.info(f"Normalize {source_name}: {inserted} normalized_events")
    return inserted


async def materialize_entities_from_normalized(session: AsyncSession, source_name: str) -> int:
    """Create event_entities (and optional losses/impacts) from normalized_events. 1:1 for now. Returns count."""
    result = await session.execute(
        select(NormalizedEvent).where(NormalizedEvent.source_name == source_name).order_by(NormalizedEvent.id)
    )
    norms = result.scalars().all()
    created = 0
    for n in norms:
        result = await session.execute(
            select(EventEntity.event_uid).where(
                EventEntity.best_source == source_name,
                EventEntity.source_record_id == n.source_record_id,
            )
        )
        if result.first() is not None:
            continue
        event_uid = str(uuid4())
        entity = EventEntity(
            event_uid=event_uid,
            canonical_event_type=n.event_type,
            canonical_title=n.title,
            start_date=n.start_date,
            end_date=n.end_date,
            country_iso2=n.country_iso2,
            region=n.region,
            city=n.city,
            lat=n.lat,
            lon=n.lon,
            best_source=n.source_name,
            source_count=1,
            source_record_id=n.source_record_id,
        )
        session.add(entity)
        await session.flush()
        # USGS: add estimated economic loss (magnitude → rough USD) for backtesting
        if n.source_name == "usgs" and isinstance(n.id, int):
            raw_result = await session.execute(
                select(RawSourceRecord).where(
                    RawSourceRecord.source_name == n.source_name,
                    RawSourceRecord.source_record_id == n.source_record_id,
                ).limit(1)
            )
            raw_row = raw_result.scalar_one_or_none()
            if raw_row and raw_row.payload:
                mag = raw_row.payload.get("magnitude")
                if mag is not None:
                    amount_usd = 10_000_000 * (10 ** (float(mag) - 5.0))
                    loss = EventLoss(
                        event_uid=event_uid,
                        loss_type="economic",
                        amount_original=Decimal(str(amount_usd)),
                        currency_original="USD",
                        amount_usd_nominal=Decimal(str(amount_usd)),
                        amount_usd_real=Decimal(str(amount_usd)),
                        base_year=BASE_YEAR,
                        source_name=n.source_name,
                        confidence=Decimal("0.6"),
                    )
                    session.add(loss)
                    await session.flush()
        created += 1
    logger.info(f"Materialize entities from {source_name}: {created} event_entities")
    return created


async def run_full_sync_usgs(days: int = 365, min_magnitude: float = 5.0) -> Dict[str, int]:
    """Run extract USGS → normalize USGS → materialize event_entities. Returns counts."""
    async with AsyncSessionLocal() as session:
        raw_count = await extract_usgs(session, days=days, min_magnitude=min_magnitude)
        norm_count = await normalize_source(session, "usgs")
        entity_count = await materialize_entities_from_normalized(session, "usgs")
        await session.commit()
        return {"raw": raw_count, "normalized": norm_count, "entities": entity_count}


async def extract_emdat_from_csv(session: AsyncSession, csv_content: str) -> int:
    """Parse EM-DAT CSV and insert into raw_source_records. Returns count inserted."""
    run_id = str(uuid4())
    run = ProcessingRun(
        run_id=run_id,
        source_name="emdat",
        started_at=datetime.now(timezone.utc),
        status="running",
        dataset_version=f"{DATASET_VERSION_BASE}-emdat-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}",
    )
    session.add(run)
    await session.flush()
    inserted = 0
    try:
        payloads = parse_emdat_csv(csv_content)
        for p in payloads:
            rid = p.get("source_record_id") or str(uuid4())
            checksum = _checksum(p)
            raw = RawSourceRecord(
                source_name="emdat",
                source_record_id=str(rid),
                fetched_at=datetime.now(timezone.utc),
                payload=p,
                checksum=checksum,
            )
            try:
                session.add(raw)
                await session.flush()
                inserted += 1
            except Exception as e:
                if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                    pass
                else:
                    raise
        run.row_count = inserted
        run.status = "success"
        run.finished_at = datetime.now(timezone.utc)
        logger.info(f"EM-DAT extract: {inserted} raw records")
        return inserted
    except Exception as e:
        run.status = "failed"
        run.finished_at = datetime.now(timezone.utc)
        run.error_count = (run.error_count or 0) + 1
        logger.exception(f"EM-DAT extract failed: {e}")
        raise


async def materialize_entities_from_normalized_emdat(session: AsyncSession) -> int:
    """Create event_entities + event_losses + event_impacts + event_recovery from normalized_events (emdat)."""
    result = await session.execute(
        select(NormalizedEvent).where(NormalizedEvent.source_name == "emdat").order_by(NormalizedEvent.id)
    )
    norms = result.scalars().all()
    created = 0
    for n in norms:
        existing = await session.execute(
            select(EventEntity.event_uid).where(
                EventEntity.best_source == "emdat",
                EventEntity.source_record_id == n.source_record_id,
            )
        )
        if existing.first() is not None:
            continue
        raw_result = await session.execute(
            select(RawSourceRecord).where(
                RawSourceRecord.source_name == "emdat",
                RawSourceRecord.source_record_id == n.source_record_id,
            ).limit(1)
        )
        raw_row = raw_result.scalar_one_or_none()
        payload = raw_row.payload if raw_row else {}
        event_uid = str(uuid4())
        entity = EventEntity(
            event_uid=event_uid,
            canonical_event_type=n.event_type,
            canonical_title=n.title,
            start_date=n.start_date,
            end_date=n.end_date,
            country_iso2=n.country_iso2,
            region=n.region,
            city=n.city,
            lat=n.lat,
            lon=n.lon,
            best_source=n.source_name,
            source_count=1,
            source_record_id=n.source_record_id,
        )
        session.add(entity)
        await session.flush()
        losses, impacts, recoveries = event_losses_impacts_recovery_from_emdat_payload(payload)
        for L in losses:
            session.add(EventLoss(event_uid=event_uid, **L))
        for I in impacts:
            session.add(EventImpact(event_uid=event_uid, **I))
        for R in recoveries:
            session.add(EventRecovery(event_uid=event_uid, **R))
        await session.flush()
        created += 1
    logger.info(f"Materialize entities from emdat: {created} event_entities")
    return created


async def run_full_sync_emdat(csv_content: str) -> Dict[str, int]:
    """Run extract EM-DAT from CSV → normalize → event_entities + losses/impacts/recovery. Returns counts."""
    async with AsyncSessionLocal() as session:
        raw_count = await extract_emdat_from_csv(session, csv_content)
        norm_count = await normalize_source(session, "emdat")
        entity_count = await materialize_entities_from_normalized_emdat(session)
        await session.commit()
        return {"raw": raw_count, "normalized": norm_count, "entities": entity_count}


def _quality_completeness(entity: EventEntity, has_losses: bool, has_impacts: bool) -> Decimal:
    """Completeness: share of key fields filled (event type, dates, geo, loss/impact)."""
    key_fields = [
        entity.canonical_event_type,
        entity.start_date,
        entity.country_iso2 or entity.region,
        entity.lat or entity.lon,
    ]
    filled = sum(1 for x in key_fields if x is not None and (str(x).strip() if isinstance(x, str) else True))
    comp = Decimal(filled) / 4 if key_fields else Decimal("0.5")
    if has_losses:
        comp = (comp + Decimal("1")) / 2
    if has_impacts:
        comp = (comp + Decimal("1")) / 2
    return min(Decimal("1"), comp)


async def score_quality_events(session: AsyncSession, source_name: Optional[str] = None) -> int:
    """
    Compute Q for each event_entity and write to data_quality_scores.
    Q = 0.35*completeness + 0.25*source_trust + 0.20*freshness + 0.20*consistency.
    """
    from sqlalchemy import delete
    q = select(EventEntity)
    if source_name:
        q = q.where(EventEntity.best_source == source_name)
    result = await session.execute(q)
    entities = result.scalars().all()
    trust_map: Dict[str, Decimal] = {}
    reg_result = await session.execute(select(SourceRegistry))
    for r in reg_result.scalars().all():
        trust_map[r.source_name] = max(Decimal("0.2"), 1 - Decimal(r.priority_rank) / 10)
    await session.execute(delete(DataQualityScore).where(DataQualityScore.entity_type == "event_entity"))
    await session.flush()
    count = 0
    for e in entities:
        loss_exists = (await session.execute(select(EventLoss.event_uid).where(EventLoss.event_uid == e.event_uid).limit(1))).first() is not None
        impact_exists = (await session.execute(select(EventImpact.event_uid).where(EventImpact.event_uid == e.event_uid).limit(1))).first() is not None
        completeness = _quality_completeness(e, loss_exists, impact_exists)
        source_trust = trust_map.get(e.best_source, Decimal("0.5"))
        freshness = Decimal("0.9")
        consistency = Decimal("0.85")
        q_score = Decimal("0.35") * completeness + Decimal("0.25") * source_trust + Decimal("0.20") * freshness + Decimal("0.20") * consistency
        q_score = min(Decimal("1"), max(Decimal("0"), q_score))
        rec = DataQualityScore(
            entity_type="event_entity",
            entity_id=e.event_uid,
            q_score=q_score,
            completeness=completeness,
            source_trust=source_trust,
            freshness=freshness,
            consistency=consistency,
        )
        session.add(rec)
        count += 1
    await session.flush()
    logger.info("Quality scored for %s event_entities", count)
    return count


async def seed_source_registry(session: AsyncSession) -> int:
    """Upsert source_registry from seed. Returns number of rows upserted."""
    from sqlalchemy import delete
    from src.data.source_registry_seed import get_source_registry_seed
    from src.models.external_risk_events import SourceRegistry

    rows = get_source_registry_seed()
    # Clear and re-insert so we always have exactly the seed (works reliably on SQLite)
    await session.execute(delete(SourceRegistry))
    await session.flush()
    for r in rows:
        rec = SourceRegistry(
            source_name=r["source_name"],
            domain=r["domain"],
            license_type=r.get("license_type"),
            refresh_frequency=r["refresh_frequency"],
            priority_rank=r["priority_rank"],
            active=r.get("active", True),
            tos_url=r.get("tos_url"),
            storage_restrictions=r.get("storage_restrictions"),
        )
        session.add(rec)
    await session.flush()
    logger.info("Source registry seeded: %s sources", len(rows))
    return len(rows)
