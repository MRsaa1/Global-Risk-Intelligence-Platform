"""
Disinformation module: analyze URL/text, label bot/coordinated/fake, campaigns, and panic-risk alerts.

Uses Phase 1 NLP sentiment; heuristics for coordination; optional fact-check stub.
When risk_score exceeds threshold, create SENTINEL alert (risk panic/crash).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.disinformation import DisinformationCampaign, DisinformationPost, DisinformationSource

logger = logging.getLogger(__name__)

PANIC_RISK_THRESHOLD = 0.75  # Above this → create alert


async def analyze_text_or_url(
    db: AsyncSession,
    text: Optional[str] = None,
    url: Optional[str] = None,
    title: Optional[str] = None,
    source_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Analyze a piece of content (text or URL). Runs NLP sentiment (if available),
    heuristics for bot/coordinated/fake, computes risk_score. Persists post and
    optionally creates alert if risk above threshold.
    """
    if not text and not url:
        return {"error": "Provide text or url"}
    content = text or ""
    if url and not content:
        # Stub: in production fetch URL content
        content = f"[URL: {url}]"
    # NLP sentiment (reuse Phase 1 service)
    sentiment_score: Optional[float] = None
    try:
        from src.services.nlp_sentiment import analyze_sentiment
        result = await analyze_sentiment(content[:5000])
        if result:
            sentiment_score = result.get("score")
    except Exception as e:
        logger.debug("NLP sentiment not available: %s", e)
    # Heuristics: negative sentiment + length → higher risk; placeholder for bot/coordinated
    risk = 0.0
    if sentiment_score is not None and sentiment_score < -0.3:
        risk = min(1.0, 0.3 + abs(sentiment_score))
    label_fake = risk > 0.6  # Placeholder
    label_bot = False  # Would need account/source metadata
    label_coordinated = False  # Would need temporal/network clustering
    topics_json = json.dumps(["general"])
    post = DisinformationPost(
        id=str(uuid4()),
        source_id=source_id,
        url=url,
        title=title or (url and url[:200]),
        content=content[:10000] if content else None,
        label_bot=label_bot,
        label_coordinated=label_coordinated,
        label_fake=label_fake,
        sentiment_score=sentiment_score,
        topics=topics_json,
        risk_score=risk,
        published_at=datetime.utcnow(),
        analyzed_at=datetime.utcnow(),
    )
    db.add(post)
    await db.flush()
    if risk >= PANIC_RISK_THRESHOLD:
        await _create_disinformation_alert(db, post.id, risk)
    return {
        "post_id": post.id,
        "sentiment_score": sentiment_score,
        "risk_score": risk,
        "label_bot": label_bot,
        "label_coordinated": label_coordinated,
        "label_fake": label_fake,
        "alert_created": risk >= PANIC_RISK_THRESHOLD,
    }


async def _create_disinformation_alert(db: AsyncSession, post_id: str, risk_score: float) -> None:
    """Create an alert when disinformation risk exceeds threshold (SENTINEL integration)."""
    try:
        from src.layers.agents.sentinel import sentinel_agent, Alert, AlertSeverity, AlertType
        alert = Alert(
            id=uuid4(),
            alert_type=AlertType.DISINFORMATION_RISK,
            severity=AlertSeverity.HIGH,
            title="Disinformation risk elevated",
            message=f"Post {post_id} exceeded panic/crash risk threshold (score={risk_score:.2f}).",
            asset_ids=[],
            exposure=risk_score,
            recommended_actions=["Review post content", "Assess market/sentiment impact"],
            created_at=datetime.utcnow(),
            source="DISINFORMATION_MODULE",
            explanation={"post_id": post_id, "risk_score": risk_score},
        )
        sentinel_agent.active_alerts[alert.id] = alert
    except Exception as e:
        logger.warning("Could not create disinformation alert: %s", e)


async def list_campaigns(
    db: AsyncSession,
    panic_elevated_only: bool = False,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """List disinformation campaigns with optional filter by risk_panic_elevated."""
    q = select(DisinformationCampaign).order_by(DisinformationCampaign.updated_at.desc().nullslast())
    if panic_elevated_only:
        q = q.where(DisinformationCampaign.risk_panic_elevated.is_(True))
    r = await db.execute(q.limit(limit))
    campaigns = r.scalars().all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "post_count": c.post_count,
            "risk_score_avg": c.risk_score_avg,
            "risk_panic_elevated": c.risk_panic_elevated,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in campaigns
    ]


async def list_posts(
    db: AsyncSession,
    campaign_id: Optional[str] = None,
    min_risk: Optional[float] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """List analyzed posts, optionally by campaign or min risk."""
    q = select(DisinformationPost).order_by(DisinformationPost.analyzed_at.desc().nullslast())
    if campaign_id:
        q = q.where(DisinformationPost.campaign_id == campaign_id)
    if min_risk is not None:
        q = q.where(DisinformationPost.risk_score >= min_risk)
    r = await db.execute(q.limit(limit))
    posts = r.scalars().all()
    return [
        {
            "id": p.id,
            "url": p.url,
            "title": p.title,
            "sentiment_score": p.sentiment_score,
            "risk_score": p.risk_score,
            "label_bot": p.label_bot,
            "label_coordinated": p.label_coordinated,
            "label_fake": p.label_fake,
            "campaign_id": p.campaign_id,
            "analyzed_at": p.analyzed_at.isoformat() if p.analyzed_at else None,
        }
        for p in posts
    ]
