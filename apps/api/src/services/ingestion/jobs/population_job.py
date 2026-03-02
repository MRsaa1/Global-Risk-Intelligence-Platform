"""
Population ingestion job: snapshot from demo_communities (no external API).

Schedule: every 24 h. Emits DATA_REFRESH_COMPLETED for Live Data Bar.
"""
from typing import Any, Dict

from src.services.ingestion.pipeline import run_ingestion_job
from src.services.ingestion.population_client import get_population_snapshot


async def _fetch_population() -> Dict[str, Any]:
    snapshot = get_population_snapshot()
    return {
        "data": snapshot,
        "affected_city_ids": None,
        "summary": {
            "total_population": snapshot.get("total_population", 0),
            "communities_count": snapshot.get("communities_count", 0),
            "updated_at": snapshot.get("updated_at"),
        },
    }


async def run_population_job() -> Dict[str, Any]:
    """Run population ingestion (demo_communities snapshot)."""
    return await run_ingestion_job(
        source_id="population",
        fetch_fn=_fetch_population,
        channel=None,
    )
