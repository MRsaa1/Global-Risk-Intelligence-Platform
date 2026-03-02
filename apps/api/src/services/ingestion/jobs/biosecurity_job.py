"""
Biosecurity ingestion job: WHO Disease Outbreak News.

Schedule: every 60 min.
"""
from typing import Any, Dict

from src.services.ingestion.pipeline import run_ingestion_job
from src.services.external.who_outbreak_client import fetch_who_outbreaks


def _serialize(obj: Any) -> Any:
    if hasattr(obj, "to_dict"):
        return obj.to_dict()
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    if isinstance(obj, list):
        return [_serialize(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    return obj


async def _fetch_biosecurity() -> Dict[str, Any]:
    summary = await fetch_who_outbreaks(days_back=90)
    data = {
        "active_outbreaks": summary.active_outbreaks,
        "total_countries_affected": summary.total_countries_affected,
        "high_severity_count": summary.high_severity_count,
        "top_diseases": _serialize(summary.top_diseases),
        "outbreaks": _serialize(summary.outbreaks),
        "fetched_at": summary.fetched_at,
    }
    return {
        "data": data,
        "affected_city_ids": None,
        "summary": {
            "active_outbreaks": summary.active_outbreaks,
            "countries_affected": summary.total_countries_affected,
        },
        "channel": "biosecurity",
    }


async def run_biosecurity_job() -> Dict[str, Any]:
    return await run_ingestion_job(
        source_id="biosecurity",
        fetch_fn=_fetch_biosecurity,
        channel="biosecurity",
    )
