"""
Entity Resolution - External API enrichment for stress test entity classification.

Optional enrichment via:
- Wikidata (no key): search entities, get industry/type when available
- OpenCorporates (api_token in settings): company search, industry codes

Used to reinforce or override keyword-based detect_entity_type when industry_code
maps to ontology (e.g. NACE 86 -> HEALTHCARE). Timeout and fallback on error.
"""
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 3.0

# Map Wikidata/Q-codes or NACE/SIC to our EntityType
INDUSTRY_TO_ENTITY_TYPE = {
    "Q16917": "HEALTHCARE",  # hospital
    "Q39614": "HEALTHCARE",  # clinic
    "Q11190": "FINANCIAL",   # bank
    "Q154950": "FINANCIAL",  # insurance
    "Q163740": "FINANCIAL",  # financial institution
    "86": "HEALTHCARE",      # NACE 86 Human health
    "64": "FINANCIAL",       # NACE 64 Financial services
    "41": "REAL_ESTATE",     # NACE 41 Buildings
    "49": "INFRASTRUCTURE",  # NACE 49 Land transport
    "51": "INFRASTRUCTURE",  # NACE 51 Air transport
    "35": "INFRASTRUCTURE",  # NACE 35 Utilities
    "84": "GOVERNMENT",      # NACE 84 Public admin
}


@dataclass
class EntityResolutionResult:
    """Result of entity resolution (optional enrichment)."""
    suggested_entity_type: Optional[str] = None  # HEALTHCARE, FINANCIAL, etc.
    industry_code: Optional[str] = None
    source: Optional[str] = None  # "wikidata" | "opencorporates"
    name: Optional[str] = None


async def resolve_entity(entity_name: str) -> Optional[EntityResolutionResult]:
    """
    Enrich entity by name via Wikidata (and optionally OpenCorporates).
    Returns suggested_entity_type when we can map industry/type; None on timeout or no match.
    """
    if not entity_name or not entity_name.strip():
        return None
    name = entity_name.strip()
    try:
        # 1. Try Wikidata (no API key)
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            wd_url = "https://www.wikidata.org/w/api.php"
            params = {
                "action": "wbsearchentities",
                "search": name,
                "language": "en",
                "limit": "3",
                "format": "json",
            }
            resp = await client.get(wd_url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                for item in (data.get("search") or [])[:1]:
                    entity_id = item.get("id")
                    desc = (item.get("description") or "").lower()
                    label = (item.get("label") or {}).get("value") or ""
                    # Check description/label for type hints
                    if "hospital" in desc or "hospital" in label.lower() or entity_id == "Q16917":
                        return EntityResolutionResult(
                            suggested_entity_type="HEALTHCARE",
                            industry_code=entity_id,
                            source="wikidata",
                            name=label or name,
                        )
                    if "bank" in desc or "financial" in desc or "insurance" in desc:
                        return EntityResolutionResult(
                            suggested_entity_type="FINANCIAL",
                            industry_code=entity_id,
                            source="wikidata",
                            name=label or name,
                        )
                    if "airport" in desc or "airport" in label.lower():
                        return EntityResolutionResult(
                            suggested_entity_type="AIRPORT",
                            industry_code=entity_id,
                            source="wikidata",
                            name=label or name,
                        )
                    if entity_id and entity_id in INDUSTRY_TO_ENTITY_TYPE:
                        return EntityResolutionResult(
                            suggested_entity_type=INDUSTRY_TO_ENTITY_TYPE[entity_id],
                            industry_code=entity_id,
                            source="wikidata",
                            name=label or name,
                        )
    except Exception as e:
        logger.debug("Entity resolution (Wikidata) failed: %s", e)

    # 2. Optional: OpenCorporates when api token is set
    api_token = getattr(settings, "opencorporates_api_token", None) or ""
    if api_token.strip():
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                oc_url = "https://api.opencorporates.com/v0.4/companies/search"
                params = {"q": name, "api_token": api_token.strip()}
                resp = await client.get(oc_url, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    companies = (data.get("results") or {}).get("companies") or []
                    for c in companies[:1]:
                        company = c.get("company") or {}
                        nace = (company.get("industry_codes") or [])
                        for ic in nace:
                            code = (ic.get("industry_code") or "").split(".")[0] if isinstance(ic, dict) else str(ic).split(".")[0]
                            if code in INDUSTRY_TO_ENTITY_TYPE:
                                return EntityResolutionResult(
                                    suggested_entity_type=INDUSTRY_TO_ENTITY_TYPE[code],
                                    industry_code=code,
                                    source="opencorporates",
                                    name=company.get("name") or name,
                                )
        except Exception as e:
            logger.debug("Entity resolution (OpenCorporates) failed: %s", e)

    return None
