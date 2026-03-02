"""
LPR (Leader/Persona Risk) service: CRUD and pipeline stubs.

- Riva: ASR + paralinguistic features (pace, pauses, stress) — use nvidia_riva when enabled.
- Maxine / Rekognition: video → emotions (stub; integrate when Maxine API available).
- Vertex AI (Gemini): transcript + metadata → doctrine comparison, contradictions, course-change (stub).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.lpr import LprAppearance, LprEntity, LprMetrics

logger = logging.getLogger(__name__)


async def get_entity(db: AsyncSession, entity_id: str) -> Optional[LprEntity]:
    """Get LPR entity by id."""
    r = await db.execute(select(LprEntity).where(LprEntity.id == entity_id))
    return r.scalar_one_or_none()


async def list_entities(
    db: AsyncSession,
    region: Optional[str] = None,
    entity_type: Optional[str] = None,
    active_only: bool = True,
) -> List[LprEntity]:
    """List LPR entities with optional filters."""
    q = select(LprEntity)
    if active_only:
        q = q.where(LprEntity.is_active.is_(True))
    if region:
        q = q.where(LprEntity.region == region)
    if entity_type:
        q = q.where(LprEntity.entity_type == entity_type)
    r = await db.execute(q)
    return list(r.scalars().all())


async def create_entity(
    db: AsyncSession,
    name: str,
    entity_type: str = "person",
    role: Optional[str] = None,
    region: Optional[str] = None,
    doctrine_ref: Optional[str] = None,
) -> LprEntity:
    """Create a new LPR entity."""
    entity = LprEntity(
        id=str(uuid4()),
        name=name,
        entity_type=entity_type,
        role=role,
        region=region,
        doctrine_ref=doctrine_ref,
    )
    db.add(entity)
    await db.flush()
    return entity


async def get_profile(db: AsyncSession, entity_id: str) -> Optional[Dict[str, Any]]:
    """
    Get full LPR profile: entity + appearances + aggregated metrics and trend flags.
    """
    entity = await get_entity(db, entity_id)
    if not entity:
        return None
    appearances_q = (
        select(LprAppearance)
        .where(LprAppearance.entity_id == entity_id)
        .order_by(LprAppearance.occurred_at.desc().nullslast(), LprAppearance.created_at.desc())
    )
    r = await db.execute(appearances_q)
    appearances = list(r.scalars().all())
    metrics_by_app: Dict[str, LprMetrics] = {}
    if appearances:
        metrics_q = select(LprMetrics).where(
            LprMetrics.appearance_id.in_([a.id for a in appearances])
        )
        r = await db.execute(metrics_q)
        for m in r.scalars().all():
            metrics_by_app[m.appearance_id] = m
    has_contradiction = any(
        metrics_by_app.get(a.id) and metrics_by_app[a.id].contradiction_flag
        for a in appearances
    )
    has_course_change = any(
        metrics_by_app.get(a.id) and metrics_by_app[a.id].course_change_flag
        for a in appearances
    )
    return {
        "entity": {
            "id": entity.id,
            "name": entity.name,
            "entity_type": entity.entity_type,
            "role": entity.role,
            "region": entity.region,
        },
        "appearances_count": len(appearances),
        "appearances": [
            {
                "id": a.id,
                "title": a.title,
                "source_type": a.source_type,
                "occurred_at": a.occurred_at.isoformat() if a.occurred_at else None,
                "metrics": _metrics_to_dict(metrics_by_app.get(a.id)),
            }
            for a in appearances[:20]
        ],
        "flags": {"contradiction_detected": has_contradiction, "course_change_detected": has_course_change},
    }


def _metrics_to_dict(m: Optional[LprMetrics]) -> Optional[Dict[str, Any]]:
    if not m:
        return None
    out = {
        "pace_wpm": m.pace_wpm,
        "pause_ratio": m.pause_ratio,
        "stress_score": m.stress_score,
        "contradiction_flag": m.contradiction_flag,
        "course_change_flag": m.course_change_flag,
        "doctrine_notes": m.doctrine_notes,
    }
    if m.emotion_scores:
        try:
            out["emotion_scores"] = json.loads(m.emotion_scores)
        except Exception:
            out["emotion_scores"] = m.emotion_scores
    if m.topics:
        try:
            out["topics"] = json.loads(m.topics) if m.topics.startswith("[") else m.topics.split(",")
        except Exception:
            out["topics"] = m.topics
    return out


async def get_trends(
    db: AsyncSession,
    entity_id: Optional[str] = None,
    region: Optional[str] = None,
    limit: int = 50,
) -> Dict[str, Any]:
    """
    LPR trends: recent appearances with stress/contradiction/course-change for dashboard.
    """
    q = select(LprAppearance, LprEntity).join(LprEntity, LprAppearance.entity_id == LprEntity.id)
    if entity_id:
        q = q.where(LprAppearance.entity_id == entity_id)
    if region:
        q = q.where(LprEntity.region == region)
    q = q.where(LprEntity.is_active.is_(True)).order_by(
        LprAppearance.occurred_at.desc().nullslast(), LprAppearance.created_at.desc()
    ).limit(limit)
    r = await db.execute(q)
    rows = r.fetchall()
    appearance_ids = [row[0].id for row in rows]
    metrics_q = select(LprMetrics).where(LprMetrics.appearance_id.in_(appearance_ids))
    r = await db.execute(metrics_q)
    metrics_by_app = {m.appearance_id: m for m in r.scalars().all()}
    trends = []
    for app, ent in rows:
        m = metrics_by_app.get(app.id)
        trends.append({
            "appearance_id": app.id,
            "entity_id": app.entity_id,
            "entity_name": ent.name,
            "title": app.title,
            "occurred_at": app.occurred_at.isoformat() if app.occurred_at else None,
            "stress_score": m.stress_score if m else None,
            "contradiction_flag": m.contradiction_flag if m else False,
            "course_change_flag": m.course_change_flag if m else False,
        })
    return {"trends": trends}


async def create_appearance(
    db: AsyncSession,
    entity_id: str,
    source_type: str = "video",
    source_url: Optional[str] = None,
    title: Optional[str] = None,
    occurred_at: Optional[datetime] = None,
    transcript: Optional[str] = None,
    language: str = "en",
) -> LprAppearance:
    """Create an LPR appearance; optionally run pipeline (Riva/Maxine/Vertex) to fill metrics."""
    entity = await get_entity(db, entity_id)
    if not entity:
        raise ValueError(f"LPR entity not found: {entity_id}")
    app = LprAppearance(
        id=str(uuid4()),
        entity_id=entity_id,
        source_type=source_type,
        source_url=source_url,
        title=title,
        occurred_at=occurred_at,
        transcript=transcript,
        language=language,
    )
    db.add(app)
    await db.flush()
    # Stub: create demo metrics if transcript present (real pipeline would call Riva/Maxine/Vertex)
    if transcript:
        await _ensure_metrics_for_appearance(db, app)
    return app


async def _ensure_metrics_for_appearance(db: AsyncSession, app: LprAppearance) -> None:
    """Create or update LprMetrics for an appearance. Demo: simple stub; production: Riva + Maxine + Vertex."""
    r = await db.execute(select(LprMetrics).where(LprMetrics.appearance_id == app.id))
    existing = r.scalar_one_or_none()
    if existing:
        return
    # Demo stub: derive simple metrics from transcript length; real impl would call Riva (pace, pauses), Maxine (emotions), Vertex (doctrine).
    word_count = len((app.transcript or "").split())
    metrics = LprMetrics(
        id=str(uuid4()),
        appearance_id=app.id,
        pace_wpm=min(180.0, max(80.0, word_count * 2.0)) if word_count else None,
        pause_ratio=0.05,
        stress_score=0.0,
        emotion_scores=json.dumps({"neutral": 0.9, "stress": 0.1}),
        topics=json.dumps(["policy", "economy"]),
        contradiction_flag=False,
        course_change_flag=False,
    )
    db.add(metrics)
    app.processed_at = datetime.utcnow()
    await db.flush()
