"""
Population snapshot for ingestion pipeline (demo_communities).
Used by population_job to emit DATA_REFRESH_COMPLETED and optional population channel.
"""
from datetime import datetime, timezone
from typing import Any, Dict

from src.data.demo_communities import DEMO_COMMUNITIES


def get_population_snapshot() -> Dict[str, Any]:
    """
    Return aggregated population snapshot from demo_communities.
    No external API; used for pipeline cache and last refresh.
    """
    total = 0
    by_region: Dict[str, int] = {}
    top_cities: list = []
    for cid, rec in DEMO_COMMUNITIES.items():
        if not isinstance(rec, dict):
            continue
        pop = rec.get("population")
        if isinstance(pop, (int, float)):
            total += int(pop)
        # Region = first 2 chars of id (country)
        region = (rec.get("id") or cid).split("-")[0] if isinstance(rec.get("id"), str) else cid.split("-")[0]
        by_region[region] = by_region.get(region, 0) + (int(pop) if isinstance(pop, (int, float)) else 0)
        top_cities.append({"id": cid, "name": rec.get("name"), "population": pop})
    top_cities.sort(key=lambda x: (x.get("population") or 0), reverse=True)
    return {
        "total_population": total,
        "by_region": by_region,
        "top_cities": top_cities[:50],
        "communities_count": len(DEMO_COMMUNITIES),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
