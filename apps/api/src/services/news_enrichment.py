"""
News / GDELT-style enrichment for stress test scenarios.

Optional integration with news or event APIs to:
- Enrich scenario context with recent geopolitical/risk events
- Auto-trigger stress_test_trigger or geopolitical_alert for dashboard

Uses NewsAPI (api_key in settings) or a placeholder GDELT-style query when enabled.
"""
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 5.0


@dataclass
class NewsEvent:
    """Single news/event item for scenario enrichment."""
    title: str
    source: str
    published_at: Optional[str] = None
    url: Optional[str] = None
    relevance_score: float = 0.5
    region: Optional[str] = None


async def fetch_events_for_region(
    region: str,
    query: Optional[str] = None,
    limit: int = 10,
) -> List[NewsEvent]:
    """
    Fetch recent events/news for a region (and optional query).
    Uses NewsAPI when api key is set; otherwise returns empty list.
    """
    events: List[NewsEvent] = []
    api_key = getattr(settings, "newsapi_api_key", None) or getattr(settings, "news_api_key", None)
    if not api_key or not api_key.strip():
        return events
    q = query or f"{region} risk OR stress OR sanctions OR conflict"
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": q[:100],
                    "language": "en",
                    "sortBy": "publishedAt",
                    "pageSize": min(limit, 20),
                    "apiKey": api_key.strip(),
                },
            )
            if resp.status_code != 200:
                return events
            data = resp.json()
            articles = data.get("articles") or []
            for a in articles[:limit]:
                events.append(
                    NewsEvent(
                        title=(a.get("title") or "").strip(),
                        source=(a.get("source") or {}).get("name", "Unknown"),
                        published_at=a.get("publishedAt"),
                        url=a.get("url"),
                        relevance_score=0.5,
                        region=region,
                    )
                )
    except Exception as e:
        logger.debug("News API fetch failed: %s", e)
    return events


async def enrich_stress_test_context(
    region: str,
    event_type: str,
    limit: int = 5,
) -> Dict[str, Any]:
    """
    Enrich stress test context with recent events (for LLM or report).
    Returns dict with events list and summary text when available.
    """
    query = None
    if "geopolitical" in event_type.lower() or "sanctions" in event_type.lower():
        query = f"{region} sanctions OR geopolitical OR conflict"
    elif "financial" in event_type.lower():
        query = f"{region} financial OR market OR bank"
    elif "climate" in event_type.lower():
        query = f"{region} climate OR flood OR storm"
    events = await fetch_events_for_region(region, query=query, limit=limit)
    if not events:
        return {"events": [], "summary": None}
    summary = "Recent context: " + "; ".join(e.title[:80] for e in events[:3])
    return {
        "events": [
            {"title": e.title, "source": e.source, "published_at": e.published_at, "url": e.url}
            for e in events
        ],
        "summary": summary,
    }


async def check_and_emit_geopolitical_alerts(region: str) -> bool:
    """
    Fetch recent events for region; if high-relevance items found,
    emit geopolitical_alert so dashboards can prompt stress test recalculation.
    Returns True if alert was emitted.
    """
    events = await fetch_events_for_region(region, query=f"{region} sanctions OR conflict OR crisis", limit=5)
    if not events:
        return False
    try:
        from src.services.event_emitter import event_emitter
        from src.models.events import EventTypes
        await event_emitter.emit_geopolitical_alert(
            region=region,
            affected_entity_ids=[],
            message=f"Recent events may affect stress test assumptions: {events[0].title[:100]}...",
            estimated_impact={"events_count": len(events)},
        )
        return True
    except Exception as e:
        logger.debug("Emit geopolitical alert failed: %s", e)
        return False
