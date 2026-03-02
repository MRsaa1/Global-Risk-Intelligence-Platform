"""
Threat intelligence ingestion job: GDELT news/OSINT.

Schedule: every 15 min.
Extracts affected_city_ids from article text (country/region mentions) for risk recalculation.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List

from src.services.ingestion.pipeline import run_ingestion_job
from src.services.ingestion.location_resolver import extract_affected_city_ids_from_text
from src.services.external.gdelt_client import GDELTClient
from src.services.external.reddit_client import get_reddit_client
from src.services.external.usgs_client import usgs_client

import structlog

logger = structlog.get_logger()

_gdelt_client: GDELTClient | None = None


def _get_gdelt() -> GDELTClient:
    global _gdelt_client
    if _gdelt_client is None:
        _gdelt_client = GDELTClient()
    return _gdelt_client


async def _fetch_threat_intelligence() -> Dict[str, Any]:
    """Fetch GDELT conflict/political signals for global risk."""
    client = _get_gdelt()
    # Single broad query for risk-relevant news (1 day for freshness)
    result = await client.doc_search(
        query="conflict OR sanctions OR disaster OR crisis",
        max_records=100,
        timespan="1day",
    )
    # Fallback query when provider responds with invalid/empty payload.
    if (not result.success) or (not result.articles):
        fallback = await client.doc_search(
            query="risk OR disruption OR emergency",
            max_records=50,
            timespan="3days",
        )
        if fallback.success and fallback.articles:
            result = fallback
    articles = [
        {
            "title": a.title,
            "text": a.title,
            "url": a.url,
            "tone": a.tone,
            "source": a.source or "gdelt",
        }
        for a in (result.articles or [])
    ]

    # Secondary fallback: public Reddit OSINT so threat feed is not empty
    # when GDELT returns invalid/empty payload.
    if not articles:
        try:
            reddit_client = get_reddit_client()
            reddit_posts = await reddit_client.fetch_risk_signals(limit_per_sub=6)
            for p in reddit_posts[:30]:
                text = f"{(p.title or '').strip()} {(p.selftext or '').strip()}".strip()
                if not text:
                    continue
                articles.append({
                    "title": (p.title or "Reddit signal")[:280],
                    "text": text[:500],
                    "url": p.url,
                    "source": f"reddit:{p.subreddit}",
                    "tone": None,
                })
        except Exception as e:
            logger.warning("Threat intelligence Reddit fallback failed", error=str(e))

    # Tertiary fallback: map real USGS seismic events into threat feed cards.
    # This guarantees a non-empty live feed even if media APIs are blocked.
    if not articles:
        try:
            quakes = await usgs_client.get_earthquake_zones_global(days=7, min_magnitude=5.0)
            quakes = sorted(quakes, key=lambda x: float(x.get("magnitude") or 0.0), reverse=True)
            for q in quakes[:30]:
                mag = q.get("magnitude")
                place = q.get("place") or "Unknown location"
                depth = q.get("depth")
                q_time = q.get("time")
                if isinstance(q_time, datetime):
                    q_time = q_time.astimezone(timezone.utc).isoformat()
                text = f"USGS detected earthquake M{mag} near {place}."
                if depth is not None:
                    text += f" Depth {depth} km."
                if q_time:
                    text += f" Time (UTC): {q_time}."
                lat = q.get("lat")
                lng = q.get("lng")
                url = "https://earthquake.usgs.gov/earthquakes/map/"
                if lat is not None and lng is not None:
                    url = f"https://earthquake.usgs.gov/earthquakes/map/?extent={lat},{lng}"
                articles.append(
                    {
                        "title": f"USGS seismic event M{mag}: {place}"[:280],
                        "text": text[:500],
                        "url": url,
                        "source": "usgs",
                        "tone": None,
                    }
                )
        except Exception as e:
            logger.warning("Threat intelligence USGS fallback failed", error=str(e))

    # Extract affected city IDs from all article titles/text for risk recalculation
    affected_city_ids: List[str] = []
    try:
        combined_text = " ".join(
            (a.get("title") or "") + " " + (a.get("text") or "")
            for a in articles[:80]
        )
        affected_city_ids = extract_affected_city_ids_from_text(combined_text, max_cities=150)
    except Exception as e:
        logger.debug("Threat intelligence extract_affected_city_ids failed", error=str(e))

    data = {"articles": articles, "total_estimate": result.total_estimate, "query": result.query}
    summary = {
        "articles_count": len(articles),
        "total_estimate": result.total_estimate,
        "affected_cities": len(affected_city_ids),
        "risk_type": "geopolitical",
    }
    return {
        "data": data,
        "affected_city_ids": affected_city_ids if affected_city_ids else None,
        "summary": summary,
        "channel": "threat_intelligence",
        "risk_type": "geopolitical",
    }


async def run_threat_intelligence_job() -> Dict[str, Any]:
    return await run_ingestion_job(
        source_id="threat_intelligence",
        fetch_fn=_fetch_threat_intelligence,
        channel="threat_intelligence",
    )
