"""
Data ingestion pipeline orchestrator.

Runs scheduled jobs per data source. For each job:
1. Fetches data from the external client (via job-specific fetch_fn).
2. Optionally compares with previous snapshot (from cache) to compute delta.
3. Emits DATA_REFRESH_COMPLETED and marks affected cities dirty.
4. Pushes updates via event_emitter (WebSocket channels).
5. When channel is threat_intelligence, broadcasts each signal as threat.social_detected.
"""
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional
import hashlib
import json
import structlog
from uuid import uuid4

from src.services.event_emitter import event_emitter
from src.models.events import EventTypes, PlatformEvent
from src.services.risk_stream_bus import mark_city_dirty
from src.services.geo_data import geo_data_service
from src.services.ingestion.events import merge_affected_city_ids_from_events
from src.api.v1.endpoints.websocket import manager as ws_manager

logger = structlog.get_logger()

CACHE_KEY_PREFIX = "ingestion:snapshot:"
CACHE_TTL_SNAPSHOT = 7 * 24 * 3600  # 7 days


def _snapshot_key(source_id: str) -> str:
    return f"{CACHE_KEY_PREFIX}{source_id}"


# Source IDs used by refresh-all and dashboard panels (must match ingestion endpoint)
LAST_REFRESH_SOURCE_IDS = [
    "market_data",
    "natural_hazards",
    "threat_intelligence",
    "weather",
    "biosecurity",
    "cyber_threats",
    "economic",
    "social_media",
    "population",
    "infrastructure",
]

# SLA: target max age in seconds per source_id (for GET /ingestion/sla-status and alerting)
SOURCE_SLA_MAX_AGE_SECONDS: Dict[str, int] = {
    "market_data": 60 * 60,
    "natural_hazards": 24 * 60 * 60,
    "threat_intelligence": 24 * 60 * 60,
    "weather": 60 * 60,
    "biosecurity": 24 * 60 * 60,
    "cyber_threats": 24 * 60 * 60,
    "economic": 24 * 60 * 60,
    "social_media": 24 * 60 * 60,
    "population": 24 * 60 * 60,
    "infrastructure": 24 * 60 * 60,
}
DEFAULT_SLA_MAX_AGE_SECONDS = 24 * 60 * 60


async def get_last_refresh_times() -> Dict[str, str]:
    """Return last refresh ISO timestamp per source_id from cache. Used by Dashboard on load."""
    out: Dict[str, str] = {}
    try:
        from src.services.cache import get_cache
        cache = await get_cache()
        for source_id in LAST_REFRESH_SOURCE_IDS:
            key = _snapshot_key(source_id)
            raw = await cache.get(key)
            if not isinstance(raw, dict):
                continue
            ts = raw.get("updated_at") or (raw.get("summary") or {}).get("updated_at")
            if isinstance(ts, str) and ts:
                out[source_id] = ts
    except Exception as e:
        logger.warning("Ingestion get_last_refresh_times failed", error=str(e))
    return out


async def get_sla_status() -> List[Dict[str, Any]]:
    """
    Return SLA status per source: last_refresh, target_max_age_seconds, status (ok|stale|fail).
    Used by GET /ingestion/sla-status and for alerting.
    """
    from dateutil import parser as date_parser
    last_refreshes = await get_last_refresh_times()
    result: List[Dict[str, Any]] = []
    now = datetime.utcnow()
    for source_id in LAST_REFRESH_SOURCE_IDS:
        target_max_age = SOURCE_SLA_MAX_AGE_SECONDS.get(source_id, DEFAULT_SLA_MAX_AGE_SECONDS)
        last_iso = last_refreshes.get(source_id)
        if not last_iso:
            result.append({
                "source_id": source_id,
                "last_refresh": None,
                "target_max_age_seconds": target_max_age,
                "status": "fail",
            })
            continue
        try:
            last_dt = date_parser.isoparse(last_iso)
            if last_dt.tzinfo:
                from datetime import timezone
                last_dt = last_dt.replace(tzinfo=timezone.utc).astimezone(timezone.utc)
            else:
                last_dt = last_dt.replace(tzinfo=None)
            age_seconds = (now - last_dt).total_seconds()
            status = "ok" if age_seconds <= target_max_age else "stale"
            result.append({
                "source_id": source_id,
                "last_refresh": last_iso,
                "target_max_age_seconds": target_max_age,
                "status": status,
                "age_seconds": round(age_seconds, 1),
            })
        except Exception:
            result.append({
                "source_id": source_id,
                "last_refresh": last_iso,
                "target_max_age_seconds": target_max_age,
                "status": "fail",
            })
    return result


async def set_last_attempt_time(source_id: str, iso_timestamp: str) -> None:
    """Write last attempt time for a source (e.g. when job failed) so Dashboard can show it."""
    try:
        from src.services.cache import get_cache
        cache = await get_cache()
        key = _snapshot_key(source_id)
        payload = {
            "source_id": source_id,
            "updated_at": iso_timestamp,
            "summary": {"updated_at": iso_timestamp, "last_attempt_only": True},
        }
        await cache.set(key, payload, ttl_seconds=CACHE_TTL_SNAPSHOT)
    except Exception as e:
        logger.warning("Ingestion set_last_attempt_time failed", source_id=source_id, error=str(e))


def _content_hash(data: Any) -> str:
    try:
        blob = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(blob.encode()).hexdigest()[:16]
    except Exception:
        return ""


async def _get_previous_snapshot(source_id: str) -> Optional[Dict[str, Any]]:
    """Load previous snapshot from cache if available."""
    try:
        from src.services.cache import get_cache
        cache = await get_cache()
        key = _snapshot_key(source_id)
        raw = await cache.get(key)
        if raw is None:
            return None
        if isinstance(raw, dict):
            return raw
        if isinstance(raw, str):
            return json.loads(raw)
        return None
    except Exception as e:
        logger.warning("Ingestion get_previous_snapshot failed", source_id=source_id, error=str(e))
        return None


async def _store_snapshot(source_id: str, data: Dict[str, Any], summary: Dict[str, Any]) -> None:
    """Store snapshot in cache for next delta comparison."""
    try:
        from src.services.cache import get_cache
        cache = await get_cache()
        key = _snapshot_key(source_id)
        payload = {
            "source_id": source_id,
            "updated_at": datetime.utcnow().isoformat(),
            "summary": summary,
            "content_hash": _content_hash(data),
        }
        await cache.set(key, payload, ttl_seconds=CACHE_TTL_SNAPSHOT)
    except Exception as e:
        logger.warning("Ingestion store_snapshot failed", source_id=source_id, error=str(e))


async def run_ingestion_job(
    source_id: str,
    fetch_fn: Callable[[], Any],
    channel: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run one ingestion job: fetch data, compare with previous snapshot, emit event, mark cities dirty.

    Args:
        source_id: Identifier for the data source (e.g. "usgs", "gdelt", "who").
        fetch_fn: Async callable that returns either:
            - (data: dict, affected_city_ids: list[str] | None), or
            - dict with keys "data", "affected_city_ids" (optional), "summary" (optional).
        channel: Optional WebSocket channel to include in summary (for logging).

    Returns:
        Result dict with keys: success, source_id, summary, delta_detected, error (if failed).
    """
    result = {
        "success": False,
        "source_id": source_id,
        "summary": {},
        "delta_detected": False,
        "error": None,
    }
    try:
        out = await fetch_fn()
        if out is None:
            result["error"] = "fetch_fn returned None"
            return result
        if isinstance(out, tuple):
            data, affected_city_ids = out[0], (out[1] if len(out) > 1 else None)
            summary = out[2] if len(out) > 2 else {"count": len(data) if isinstance(data, (list, dict)) else 1}
        elif isinstance(out, dict):
            data = out.get("data", out)
            affected_city_ids = out.get("affected_city_ids")
            if affected_city_ids is None and out.get("events"):
                affected_city_ids = merge_affected_city_ids_from_events(out["events"], max_cities=300)
            summary = out.get("summary", {"count": len(data) if isinstance(data, (list, dict)) else 1})
        else:
            data = out
            affected_city_ids = None
            summary = {"count": 1}
        if not isinstance(summary, dict):
            summary = {"value": summary}
        summary["source_id"] = source_id
        summary["updated_at"] = datetime.utcnow().isoformat()
        if channel:
            summary["channel"] = channel

        prev = await _get_previous_snapshot(source_id)
        new_hash = _content_hash(data)
        delta_detected = True
        if prev and prev.get("content_hash") == new_hash:
            delta_detected = False
        result["delta_detected"] = delta_detected
        result["summary"] = summary

        await _store_snapshot(source_id, data if isinstance(data, dict) else {"payload": str(type(data))}, summary)

        await event_emitter.emit_data_refresh_completed(
            source_id=source_id,
            summary=summary,
            affected_city_ids=affected_city_ids,
        )

        # Broadcast individual threat signals to threat_intelligence so the dashboard feed can show them
        if channel == "threat_intelligence" and isinstance(data, dict):
            signals_to_send: List[Dict[str, Any]] = []
            if "signals" in data and isinstance(data["signals"], list):
                for s in data["signals"]:
                    if not isinstance(s, dict):
                        continue
                    raw_ts = s.get("created_at") or s.get("created_utc")
                    if isinstance(raw_ts, datetime):
                        ts = raw_ts.isoformat()
                    elif raw_ts is not None:
                        ts = str(raw_ts)
                    else:
                        ts = datetime.utcnow().isoformat()
                    signals_to_send.append({
                        "source": s.get("source", "social"),
                        "text": (s.get("text") or s.get("title") or "")[:500],
                        "sentiment_score": s.get("sentiment_score"),
                        "threat_level": s.get("threat_level"),
                        "risk_type": s.get("risk_type"),
                        "url": s.get("url"),
                        "entities": s.get("entities"),
                        "timestamp": ts,
                    })
            elif "articles" in data and isinstance(data["articles"], list):
                for a in data["articles"]:
                    if not isinstance(a, dict):
                        continue
                    signals_to_send.append({
                        "source": a.get("source", "gdelt"),
                        "text": (a.get("title") or "")[:500],
                        "url": a.get("url"),
                        "timestamp": datetime.utcnow().isoformat(),
                    })
            for sig in signals_to_send[:50]:
                try:
                    payload = {
                        "event_id": str(uuid4()),
                        "event_type": "threat.social_detected",
                        "version": "1.0",
                        "timestamp": sig.get("timestamp", datetime.utcnow().isoformat()),
                        "entity_type": "threat",
                        "entity_id": str(uuid4()),
                        "action": "detected",
                        "data": sig,
                        "intent": False,
                        "actor_type": "system",
                    }
                    await ws_manager.broadcast_to_channel("threat_intelligence", payload)
                except Exception as e:
                    logger.warning("Pipeline broadcast threat signal failed", error=str(e))

        # Broadcast one payload to channel for data-source panels (natural_hazards, weather, biosecurity, cyber_threats, infrastructure)
        DATA_SOURCE_CHANNELS = ("natural_hazards", "weather", "biosecurity", "cyber_threats", "infrastructure")
        if channel in DATA_SOURCE_CHANNELS and isinstance(data, dict):
            last_events: List[Dict[str, Any]] = []
            updated_at = summary.get("updated_at", datetime.utcnow().isoformat())
            if channel == "natural_hazards":
                for item in (data.get("earthquakes") or [])[-10:]:
                    last_events.append({
                        "type": "earthquake",
                        "lat": item.get("lat"),
                        "lng": item.get("lng"),
                        "magnitude": item.get("magnitude"),
                        "place": item.get("place"),
                        "time": item.get("time"),
                    })
                for item in (data.get("fires") or [])[-10:]:
                    last_events.append({
                        "type": "fire",
                        "lat": item.get("latitude") or item.get("lat"),
                        "lng": item.get("longitude") or item.get("lng"),
                        "confidence": item.get("confidence"),
                        "bright_ti4": item.get("bright_ti4"),
                    })
                for item in (data.get("alerts") or [])[-10:]:
                    last_events.append({
                        "type": "alert",
                        "event": item.get("event"),
                        "headline": item.get("headline"),
                        "severity": item.get("severity"),
                        "areas": item.get("areas"),
                    })
            elif channel == "weather":
                for i, pt in enumerate((data.get("points") or [])[-15:]):
                    last_events.append({
                        "type": "forecast",
                        "index": i,
                        "lat": pt.get("latitude") if isinstance(pt, dict) else None,
                        "lng": pt.get("longitude") if isinstance(pt, dict) else None,
                        "summary": str(pt)[:200] if pt else None,
                    })
            elif channel == "biosecurity":
                for item in (data.get("outbreaks") or [])[-15:]:
                    last_events.append({
                        "type": "outbreak",
                        "disease": item.get("disease") if isinstance(item, dict) else None,
                        "country": item.get("country") if isinstance(item, dict) else None,
                        "date": item.get("date") if isinstance(item, dict) else None,
                    })
            elif channel == "cyber_threats":
                items = data.get("items") or data.get("vulns") or (data.get("vulnerabilities") if isinstance(data.get("vulnerabilities"), list) else [])
                for item in (items if isinstance(items, list) else [])[-15:]:
                    last_events.append({
                        "type": "kev",
                        "cve_id": item.get("cveID") or item.get("cve_id") if isinstance(item, dict) else None,
                        "vendor": item.get("vendorProject") or item.get("vendor") if isinstance(item, dict) else None,
                        "date_added": item.get("dateAdded") or item.get("date_added") if isinstance(item, dict) else None,
                    })
            elif channel == "infrastructure":
                items = data.get("items") or []
                for item in (items if isinstance(items, list) else [])[-15:]:
                    if isinstance(item, dict):
                        last_events.append({
                            "type": "infrastructure",
                            "id": item.get("id"),
                            "cip_id": item.get("cip_id"),
                            "name": item.get("name"),
                            "criticality_level": item.get("criticality_level"),
                        })
            payload = {
                "source_id": source_id,
                "summary": summary,
                "updated_at": updated_at,
                "last_events": last_events,
            }
            try:
                await ws_manager.broadcast_to_channel(channel, payload)
            except Exception as e:
                logger.warning("Pipeline broadcast data source failed", channel=channel, error=str(e))
            result["last_events"] = last_events
            result["snapshot_updated_at"] = updated_at

        if affected_city_ids:
            for cid in affected_city_ids[:100]:
                await mark_city_dirty(str(cid))
            try:
                await geo_data_service.recalculate_cities(
                    [str(c) for c in affected_city_ids],
                    max_cities=300,
                )
            except Exception as recalc_err:
                logger.warning(
                    "Ingestion recalculate_cities failed",
                    source_id=source_id,
                    error=str(recalc_err),
                )

        result["success"] = True
        logger.info(
            "Ingestion job completed",
            source_id=source_id,
            delta_detected=delta_detected,
            affected_cities=len(affected_city_ids) if affected_city_ids else 0,
        )
        return result
    except Exception as e:
        result["error"] = str(e)
        logger.warning("Ingestion job failed", source_id=source_id, error=str(e))
        try:
            await set_last_attempt_time(source_id, datetime.utcnow().isoformat())
        except Exception:
            pass
        return result
