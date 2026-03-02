"""
Hidden concentration metrics: single supplier, single technology, single region.

Computes Herfindahl and concentration flags from Knowledge Graph and/or SCSS suppliers.
Used for reports and GET /risk-zones/concentration (or /concentration) API.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def herfindahl_index(shares: List[float]) -> float:
    """Herfindahl-Hirschman index: sum of squared shares. 1.0 = single provider."""
    if not shares:
        return 0.0
    total = sum(shares)
    if total <= 0:
        return 0.0
    return sum((s / total) ** 2 for s in shares)


async def get_concentration_for_assets(
    asset_ids: Optional[List[str]] = None,
    db_session=None,
) -> Dict[str, Any]:
    """
    Compute concentration metrics for given assets (or whole portfolio when asset_ids is empty).
    Uses SCSS suppliers and routes; returns Herfindahl by supplier, region, technology and single-source flags.
    """
    result = {
        "by_supplier": {"herfindahl": 0.0, "single_source": False, "top_n": []},
        "by_region": {"herfindahl": 0.0, "single_region": False, "top_n": []},
        "by_technology": {"herfindahl": 0.0, "single_technology": False, "top_n": []},
        "message": "Concentration from SCSS when available.",
    }
    if not db_session:
        return result
    try:
        from sqlalchemy import select, func
        from src.modules.scss.models import Supplier, SupplyRoute

        # By supplier: count routes per source_id (exposure per supplier)
        q_routes = (
            select(SupplyRoute.source_id, func.count(SupplyRoute.id).label("route_count"))
            .where(SupplyRoute.source_id.isnot(None))
            .group_by(SupplyRoute.source_id)
        )
        res = await db_session.execute(q_routes)
        rows = res.fetchall()
        route_counts = [r[1] for r in rows]
        if route_counts:
            h_supplier = herfindahl_index(route_counts)
            result["by_supplier"]["herfindahl"] = round(h_supplier, 4)
            result["by_supplier"]["single_source"] = h_supplier >= 0.9
            result["by_supplier"]["top_n"] = [
                {"supplier_id": r[0], "route_count": r[1]}
                for r in sorted(rows, key=lambda x: x[1], reverse=True)[:5]
            ]

        # By region (country) from suppliers
        q_region = (
            select(Supplier.country_code, func.count(Supplier.id).label("cnt"))
            .where(Supplier.is_active.is_(True))
            .group_by(Supplier.country_code)
        )
        res = await db_session.execute(q_region)
        region_rows = res.fetchall()
        region_counts = [r[1] for r in region_rows]
        if region_counts:
            h_region = herfindahl_index(region_counts)
            result["by_region"]["herfindahl"] = round(h_region, 4)
            result["by_region"]["single_region"] = h_region >= 0.9
            result["by_region"]["top_n"] = [{"country_code": r[0], "supplier_count": r[1]} for r in sorted(region_rows, key=lambda x: x[1], reverse=True)[:5]]

        # By technology (supplier_type)
        q_tech = (
            select(Supplier.supplier_type, func.count(Supplier.id).label("cnt"))
            .where(Supplier.is_active.is_(True))
            .group_by(Supplier.supplier_type)
        )
        res = await db_session.execute(q_tech)
        tech_rows = res.fetchall()
        tech_counts = [r[1] for r in tech_rows]
        if tech_counts:
            h_tech = herfindahl_index(tech_counts)
            result["by_technology"]["herfindahl"] = round(h_tech, 4)
            result["by_technology"]["single_technology"] = h_tech >= 0.9
            result["by_technology"]["top_n"] = [{"supplier_type": r[0], "count": r[1]} for r in sorted(tech_rows, key=lambda x: x[1], reverse=True)[:5]]
    except Exception as e:
        logger.warning("Concentration computation failed: %s", e)
        result["message"] = str(e)
    return result
