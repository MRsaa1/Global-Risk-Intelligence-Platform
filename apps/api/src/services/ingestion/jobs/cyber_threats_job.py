"""
Cyber threats ingestion job: CISA KEV, MITRE ATT&CK.

Schedule: every 6 hours.
"""
from typing import Any, Dict

from src.services.ingestion.pipeline import run_ingestion_job
from src.services.external.cisa_kev_client import fetch_cisa_kev


def _serialize(obj: Any) -> Any:
    if hasattr(obj, "to_dict"):
        return obj.to_dict()
    if isinstance(obj, list):
        return [_serialize(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    return obj


async def _fetch_cyber_threats() -> Dict[str, Any]:
    summary = await fetch_cisa_kev(days_back=90)
    data = _serialize(summary)
    return {
        "data": data,
        "affected_city_ids": None,
        "summary": {
            "total_kev_count": summary.total_kev_count,
            "critical_count": summary.critical_count,
            "threat_level": summary.threat_level,
        },
        "channel": "cyber_threats",
    }


async def run_cyber_threats_job() -> Dict[str, Any]:
    return await run_ingestion_job(
        source_id="cyber_threats",
        fetch_fn=_fetch_cyber_threats,
        channel="cyber_threats",
    )
