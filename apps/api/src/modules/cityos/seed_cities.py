"""
Seed CityOS city twins from internal sources (demo_communities, CITIES_DATABASE, optional cities-by-country).

Run via POST /api/v1/seed/cityos or call seed_cityos_cities(db).
Idempotent: skips cities that already exist by cityos_id (derived from community id or city id).
"""
import json
import logging
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.data.demo_communities import DEMO_COMMUNITIES as _DEMO_COMMUNITIES_JSON, TEXAS_COMMUNITIES as _TEXAS_COMMUNITIES
from src.modules.cityos.models import CityTwin

logger = logging.getLogger(__name__)

_DEMO_COMMUNITIES = {**_DEMO_COMMUNITIES_JSON, **_TEXAS_COMMUNITIES}

# Map CITIES_DATABASE country name to ISO 2-letter code
_COUNTRY_TO_CODE = {
    "USA": "US", "US": "US", "United States": "US",
    "Germany": "DE", "DE": "DE", "Japan": "JP", "JP": "JP",
    "UK": "GB", "United Kingdom": "GB", "GB": "GB",
    "France": "FR", "FR": "FR", "China": "CN", "CN": "CN",
    "India": "IN", "IN": "IN", "Brazil": "BR", "BR": "BR",
    "Canada": "CA", "CA": "CA", "Australia": "AU", "AU": "AU",
    "Italy": "IT", "IT": "IT", "Spain": "ES", "ES": "ES",
    "Mexico": "MX", "MX": "MX", "Russia": "RU", "RU": "RU",
    "Netherlands": "NL", "NL": "NL", "South Korea": "KR", "KR": "KR",
    "Turkey": "TR", "TR": "TR", "Indonesia": "ID", "ID": "ID",
}


def _country_from_community_id(cid: str) -> str:
    """Extract ISO 2-letter country from community id like 'DE-2950159' or 'bastrop_tx'."""
    if "_" in cid:
        if "tx" in cid.lower() or "texas" in cid.lower():
            return "US"
        return "US"
    if "-" in cid:
        return cid.split("-")[0].upper()[:2]
    return "XX"


def _country_code(c: str) -> str:
    """Normalize country to 2-letter code."""
    if not c:
        return "XX"
    s = (c or "").strip()
    return _COUNTRY_TO_CODE.get(s) or _COUNTRY_TO_CODE.get(s.upper()) or (s[:2].upper() if len(s) >= 2 else "XX")


async def seed_cityos_cities(
    db: AsyncSession,
    limit: int = 200,
    use_cities_database: bool = True,
    use_cities_by_country: bool = False,
    cities_by_country_limit: int = 500,
) -> dict:
    """
    Create CityOS city twins from demo_communities, then CITIES_DATABASE, then optionally cities-by-country.json.
    Idempotent: does not duplicate by cityos_id.
    """
    existing = await db.execute(select(CityTwin.cityos_id))
    existing_ids = {r for r in existing.scalars()}
    added = 0

    # 1) Demo communities
    for cid, comm in list(_DEMO_COMMUNITIES.items())[:limit]:
        cityos_id = f"CITYOS-CITY-{cid.replace(' ', '_')}"
        if cityos_id in existing_ids:
            continue
        country = _country_from_community_id(cid)
        city = CityTwin(
            id=str(uuid4()),
            cityos_id=cityos_id,
            name=comm.get("name", cid),
            country_code=country,
            latitude=comm.get("lat"),
            longitude=comm.get("lng"),
            population=comm.get("population"),
            description=f"Seeded from demo community {cid}",
        )
        db.add(city)
        existing_ids.add(cityos_id)
        added += 1

    # 2) CITIES_DATABASE (get_all_cities)
    if use_cities_database:
        try:
            from src.data.cities import get_all_cities
            for c in get_all_cities():
                cityos_id = f"CITYOS-CITY-{c.id}"
                if cityos_id in existing_ids:
                    continue
                country_code = _country_code(c.country)
                city = CityTwin(
                    id=str(uuid4()),
                    cityos_id=cityos_id,
                    name=c.name,
                    country_code=country_code,
                    latitude=c.lat,
                    longitude=c.lng,
                    population=None,
                    description="Seeded from CITIES_DATABASE",
                )
                db.add(city)
                existing_ids.add(cityos_id)
                added += 1
        except Exception as e:
            logger.warning("CityOS seed CITIES_DATABASE failed: %s", e)

    # 3) Optional: cities-by-country.json (limit to avoid long seed)
    if use_cities_by_country and cities_by_country_limit > 0:
        try:
            # Prefer apps/api/data/ or repo root apps/web/public/data/
            for base in [Path(__file__).resolve().parents[3] / "web" / "public" / "data", Path(__file__).resolve().parents[3] / "data"]:
                path = base / "cities-by-country.json"
                if path.exists():
                    with open(path) as f:
                        data = json.load(f)
                    seen = set()
                    n = 0
                    for country_code, cities in (data if isinstance(data, dict) else {}).items():
                        if n >= cities_by_country_limit:
                            break
                        for item in (cities if isinstance(cities, list) else [])[:50]:
                            if n >= cities_by_country_limit:
                                break
                            name = (item.get("name") or item.get("city") or "").strip()
                            if not name:
                                continue
                            key = (name, (country_code or "XX")[:2])
                            if key in seen:
                                continue
                            seen.add(key)
                            cityos_id = f"CITYOS-CITY-{country_code}-{name.replace(' ', '_')}"[:100]
                            if cityos_id in existing_ids:
                                continue
                            lat = item.get("lat") or item.get("latitude")
                            lng = item.get("lng") or item.get("longitude")
                            pop = item.get("population")
                            city = CityTwin(
                                id=str(uuid4()),
                                cityos_id=cityos_id,
                                name=name[:255],
                                country_code=(country_code or "XX")[:2],
                                latitude=float(lat) if lat is not None else None,
                                longitude=float(lng) if lng is not None else None,
                                population=int(pop) if pop is not None else None,
                                description="Seeded from cities-by-country.json",
                            )
                            db.add(city)
                            existing_ids.add(cityos_id)
                            added += 1
                            n += 1
                    break
        except Exception as e:
            logger.warning("CityOS seed cities-by-country failed: %s", e)

    await db.commit()
    logger.info("CityOS seed: added %s city twins", added)
    return {"added": added, "total_communities": len(_DEMO_COMMUNITIES)}
