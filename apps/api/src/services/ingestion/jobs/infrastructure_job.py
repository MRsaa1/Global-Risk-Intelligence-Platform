"""
Infrastructure (CIP) feed job: list critical infrastructure for dashboard.

Schedule: every 1 h. Emits DATA_REFRESH_COMPLETED; broadcasts to infrastructure channel
when pipeline supports it.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List

import structlog

from src.core.database import AsyncSessionLocal
from src.services.ingestion.pipeline import run_ingestion_job
from src.modules.cip.service import CIPService

logger = structlog.get_logger()


def _serialize_infra(infra: Any) -> Dict[str, Any]:
    """Serialize one CriticalInfrastructure for JSON."""
    if not hasattr(infra, "id"):
        return {}
    return {
        "id": getattr(infra, "id", None),
        "cip_id": getattr(infra, "cip_id", None),
        "name": getattr(infra, "name", None),
        "infrastructure_type": getattr(infra, "infrastructure_type", None),
        "criticality_level": getattr(infra, "criticality_level", None),
        "country_code": getattr(infra, "country_code", None),
    }


async def _fetch_infrastructure() -> Dict[str, Any]:
    """Fetch CIP infrastructure list (or stub if CIP unavailable)."""
    try:
        async with AsyncSessionLocal() as session:
            service = CIPService(session)
            infra_list = await service.list_infrastructure(limit=100, offset=0)
        items = [_serialize_infra(i) for i in infra_list if i]
        updated_at = datetime.now(timezone.utc).isoformat()
        return {
            "data": {"items": items, "count": len(items), "updated_at": updated_at},
            "affected_city_ids": None,
            "summary": {"count": len(items), "updated_at": updated_at, "sources": ["CIP"]},
            "channel": "infrastructure",
        }
    except Exception as e:
        logger.warning("Infrastructure fetch failed, returning stub", error=str(e))
        updated_at = datetime.now(timezone.utc).isoformat()
        return {
            "data": {"items": [], "count": 0, "updated_at": updated_at},
            "affected_city_ids": None,
            "summary": {"count": 0, "updated_at": updated_at, "sources": ["CIP"], "error": str(e)},
            "channel": "infrastructure",
        }


async def run_infrastructure_job() -> Dict[str, Any]:
    """Run infrastructure feed job."""
    return await run_ingestion_job(
        source_id="infrastructure",
        fetch_fn=_fetch_infrastructure,
        channel="infrastructure",
    )
