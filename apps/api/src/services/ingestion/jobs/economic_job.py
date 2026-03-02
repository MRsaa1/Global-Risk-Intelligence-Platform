"""
Economic data ingestion job: World Bank, IMF, OFAC.

Schedule: every 24 hours.
Returns affected_city_ids from countries in the data for risk recalculation.
"""
import asyncio
from typing import Any, Dict, List, Set

from src.services.ingestion.pipeline import run_ingestion_job
from src.services.ingestion.location_resolver import country_iso2_to_city_ids
from src.services.external.worldbank_client import worldbank_client
from src.services.external.imf_client import imf_client
from src.services.external.ofac_client import ofac_client

# World Bank / IMF country codes -> ISO2 for location_resolver
_COUNTRY_CODE_TO_ISO2: Dict[str, str] = {
    "USA": "US", "GBR": "GB", "DEU": "DE", "FRA": "FR", "CHN": "CN", "JPN": "JP",
    "IND": "IN", "BRA": "BR", "MEX": "MX", "ITA": "IT", "ESP": "ES", "CAN": "CA",
}


def _serialize(obj: Any) -> Any:
    if hasattr(obj, "to_dict"):
        return obj.to_dict()
    if hasattr(obj, "__dict__") and not isinstance(obj, type):
        return {k: _serialize(v) for k, v in obj.__dict__.items() if not k.startswith("_")}
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    if isinstance(obj, (list, tuple)):
        return [_serialize(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    return obj


async def _fetch_economic() -> Dict[str, Any]:
    # Refresh OFAC/UN sanctions list
    await ofac_client.refresh()
    sanctions_count = len(getattr(ofac_client, "_country_programs", {}) or {})

    # Sample countries for World Bank and IMF
    countries = ["USA", "GBR", "DEU"]
    wb_snapshots = await asyncio.gather(*[worldbank_client.get_country_snapshot(c) for c in countries])
    imf_snapshots = await asyncio.gather(*[imf_client.get_country_snapshot(c) for c in countries])

    affected: Set[str] = set()
    for code in countries:
        iso2 = _COUNTRY_CODE_TO_ISO2.get(code) or code[:2].upper()
        for cid in country_iso2_to_city_ids(iso2):
            affected.add(cid)
    # OFAC: if we had country list we could add those cities; skip for now to avoid extra dependency

    data = {
        "world_bank": [_serialize(s) for s in wb_snapshots],
        "imf": [_serialize(s) for s in imf_snapshots],
        "sanctions_countries_count": sanctions_count,
    }
    summary = {
        "world_bank_countries": len(wb_snapshots),
        "imf_countries": len(imf_snapshots),
        "sanctions_countries": sanctions_count,
        "affected_cities": len(affected),
        "risk_type": "economic",
    }
    return {
        "data": data,
        "affected_city_ids": list(affected)[:200] if affected else None,
        "summary": summary,
        "channel": "economic",
        "risk_type": "economic",
    }


async def run_economic_job() -> Dict[str, Any]:
    return await run_ingestion_job(
        source_id="economic",
        fetch_fn=_fetch_economic,
        channel="economic",
    )
