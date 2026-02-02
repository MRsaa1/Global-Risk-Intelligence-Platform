"""
Region-specific emergency action plans for stress test reports.

Curated summaries and links to official plans (VICSES, VicEmergency, etc.)
combined with our risk calculations for richer reports.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

# Event type keywords for matching
FLOOD_KEYWORDS = ("flood", "sea_level", "sea-level", "tsunami", "storm", "hurricane", "ngfs", "ssp")


@dataclass
class RegionActionPlan:
    """Regional action plan for a given location and event type."""

    region: str
    country: str
    event_type: str
    summary: str
    key_actions: list[str]
    contacts: list[dict]
    sources: list[dict]
    urls: list[str]


# Curated action plans: (region_key, event_type_key) -> plan
# region_key: normalized city/region (e.g. "melbourne", "victoria", "australia")
# event_type_key: "flood", "fire", "seismic", etc.
_PLANS: dict[tuple[str, str], RegionActionPlan] = {}


def _register(
    region: str,
    country: str,
    event_type: str,
    summary: str,
    key_actions: list[str],
    contacts: list[dict],
    sources: list[dict],
    urls: list[str],
) -> None:
    k = (region.lower().strip(), event_type.lower().strip())
    _PLANS[k] = RegionActionPlan(
        region=region,
        country=country,
        event_type=event_type,
        summary=summary,
        key_actions=key_actions,
        contacts=contacts,
        sources=sources,
        urls=urls,
    )


# Australia / Victoria / Melbourne - Flood
_register(
    region="melbourne",
    country="australia",
    event_type="flood",
    summary=(
        "Victoria State Emergency Service (VICSES) is the control agency for flood in Victoria. "
        "Melbourne has documented flood history (2010, 2005) with riverine and flash flood risks "
        "in CBD, Southbank, Kensington, North Melbourne. City of Melbourne maintains a Municipal "
        "Flood Emergency Plan and local flood guides. Residents and businesses should develop "
        "emergency plans, assemble emergency kits, and maintain property preparedness."
    ),
    key_actions=[
        "Call VICSES 132 500 for flood/storm emergencies (flooded property, structural damage)",
        "Life-threatening emergencies: call 000",
        "VicEmergency hotline 1800 226 226 for flood information",
        "Deploy flood barriers and sandbags if available",
        "Evacuate basement levels and low-lying areas",
        "Secure electrical equipment above flood level",
        "Establish emergency shelters on high ground",
    ],
    contacts=[
        {"name": "VICSES Flood/Storm", "phone": "132 500"},
        {"name": "Life-threatening", "phone": "000"},
        {"name": "VicEmergency", "phone": "1800 226 226"},
    ],
    sources=[
        {"title": "VICSES - What to do in an emergency", "url": "https://www.ses.vic.gov.au/plan-and-stay-safe/what-to-do-in-an-emergency"},
        {"title": "State Emergency Response Plan - Storm Sub-Plan", "url": "https://www.ses.vic.gov.au/documents/8655930/8998580/State+Emergency+Response+Plan+-+Storm+Sub-Plan"},
        {"title": "City of Melbourne - Flood guides", "url": "https://www.ses.vic.gov.au/plan-and-stay-safe/flood-guides/melbourne-city-council"},
        {"title": "Melbourne - Floods and storms", "url": "https://www.melbourne.vic.gov.au/floods-and-storms"},
    ],
    urls=[
        "https://www.ses.vic.gov.au/plan-and-stay-safe/what-to-do-in-an-emergency",
        "https://www.melbourne.vic.gov.au/floods-and-storms",
    ],
)

# Broader Victoria
_register(
    region="victoria",
    country="australia",
    event_type="flood",
    summary=(
        "VICSES is the primary control agency for flood in Victoria. In 2023-24, VICSES responded "
        "to 31,512 emergency incidents. The State Emergency Management Plan (Storm Sub-plan) provides "
        "the framework. Call 132 500 for flood/storm assistance."
    ),
    key_actions=[
        "Call 132 500 for flood and storm assistance",
        "Check VicEmergency app or website for warnings",
        "Follow evacuation orders from emergency services",
        "Never drive through floodwaters",
    ],
    contacts=[
        {"name": "VICSES", "phone": "132 500"},
        {"name": "VicEmergency", "phone": "1800 226 226"},
    ],
    sources=[{"title": "VICSES", "url": "https://www.ses.vic.gov.au"}],
    urls=["https://www.ses.vic.gov.au"],
)

# Australia (generic)
_register(
    region="australia",
    country="australia",
    event_type="flood",
    summary=(
        "Flood response is coordinated at state level. Each state has its own SES (State Emergency Service). "
        "Victoria: VICSES 132 500. NSW: SES 132 500. Queensland: 132 500. Check local state emergency "
        "services for regional plans."
    ),
    key_actions=[
        "Contact state SES: 132 500 (Australia-wide number)",
        "Monitor Bureau of Meteorology for flood warnings",
        "Follow local emergency service advice",
    ],
    contacts=[{"name": "SES Australia", "phone": "132 500"}],
    sources=[],
    urls=["https://www.ses.vic.gov.au"],
)

# USA / Chicago - Flood (generic; no city-specific plan like Melbourne)
_register(
    region="chicago",
    country="usa",
    event_type="flood",
    summary=(
        "Flood preparedness in the Chicago region is coordinated by local emergency management, "
        "Illinois Emergency Management Agency (IEMA), and FEMA. Chicago and Cook County have "
        "flood histories along the Chicago River, Des Plaines River, and during extreme rainfall. "
        "Residents and businesses should follow local alerts, avoid flooded areas, and refer to "
        "municipal and county flood plans and FEMA flood resources."
    ),
    key_actions=[
        "Life-threatening emergencies: call 911",
        "Notify 311 for non-emergency flooding and infrastructure issues (Chicago)",
        "Follow Cook County and Chicago OEM alerts and evacuation orders",
        "Avoid driving through floodwaters; do not enter flooded basements with power on",
        "Use FEMA and Ready.gov for flood preparedness and recovery",
    ],
    contacts=[
        {"name": "Emergency", "phone": "911"},
        {"name": "Chicago 311", "phone": "311"},
        {"name": "FEMA Helpline", "phone": "1-800-621-3362"},
    ],
    sources=[
        {"title": "Ready.gov - Floods", "url": "https://www.ready.gov/floods"},
        {"title": "FEMA Flood Map Service", "url": "https://msc.fema.gov"},
    ],
    urls=["https://www.ready.gov/floods", "https://www.fema.gov"],
)

# USA (generic fallback for US cities)
_register(
    region="usa",
    country="usa",
    event_type="flood",
    summary=(
        "Flood response in the US is led by state and local emergency management with FEMA support. "
        "Check state and county emergency management offices and FEMA for regional flood plans, "
        "evacuation routes, and recovery resources."
    ),
    key_actions=[
        "Life-threatening emergencies: call 911",
        "Follow state and local emergency alerts and evacuation orders",
        "Use Ready.gov and FEMA for preparedness and recovery",
    ],
    contacts=[{"name": "FEMA", "phone": "1-800-621-3362"}],
    sources=[{"title": "Ready.gov", "url": "https://www.ready.gov/floods"}],
    urls=["https://www.ready.gov/floods"],
)


def _normalize_region(s: str) -> str:
    """Normalize region name for lookup."""
    if not s:
        return ""
    s = s.lower().strip()
    # Remove common suffixes: ", Australia", " VIC", " (Victoria)"
    for suffix in (", australia", ", victoria", " vic", " (victoria)", " (australia)"):
        if suffix in s:
            s = s.split(suffix)[0].strip()
    return s.replace(" ", "").replace("-", "")


# Australian region keys: use these only when report is for Australia, not as global fallback
_AU_REGION_KEYS = ("melbourne", "victoria", "australia", "sydney", "brisbane")
_US_REGION_KEYS = ("chicago", "usa")


def _is_australian_region(city_name: str) -> bool:
    """True if city/region name indicates Australia (so AU-specific plans are relevant)."""
    if not city_name:
        return False
    s = (city_name or "").lower()
    return any(au in s for au in ("melbourne", "victoria", "australia", "sydney", "brisbane", "queensland", "nsw", "vic "))


def _is_us_region(city_name: str) -> bool:
    """True if city/region name indicates USA (so US-specific plans are relevant)."""
    if not city_name:
        return False
    s = (city_name or "").lower()
    return any(
        us in s
        for us in (
            "chicago",
            "new york",
            "houston",
            "miami",
            "los angeles",
            "usa",
            "united states",
            "illinois",
            "texas",
            "florida",
            "california",
        )
    )


def get_plan(city_name: str, event_id: str) -> Optional[RegionActionPlan]:
    """
    Return a region action plan if one matches the city and event.

    Matches on normalized city/region and event type (flood, fire, etc.).
    Australian fallbacks (melbourne, victoria, australia) are used only when
    the report is for an Australian location — never for other regions (e.g. Chicago).
    """
    city_norm = _normalize_region(city_name or "")
    event_lower = (event_id or "").lower()

    # Determine event type from event_id
    event_type = "flood" if any(kw in event_lower for kw in FLOOD_KEYWORDS) else "general"

    # 1) Exact match for this city/region
    if city_norm:
        plan = _PLANS.get((city_norm, event_type)) or _PLANS.get((city_norm, "general"))
        if plan:
            return plan

    # 2) Australian fallbacks only when the report is for Australia
    if _is_australian_region(city_name or ""):
        for rk in _AU_REGION_KEYS:
            plan = _PLANS.get((rk, event_type)) or _PLANS.get((rk, "general"))
            if plan:
                return plan

    # 3) US fallbacks only when the report is for USA
    # Prefer USA generic for non-Chicago US cities (e.g. Miami); Chicago gets Chicago-specific plan.
    if _is_us_region(city_name or ""):
        us_keys = ("chicago", "usa") if city_norm == "chicago" else ("usa", "chicago")
        for rk in us_keys:
            plan = _PLANS.get((rk, event_type)) or _PLANS.get((rk, "general"))
            if plan:
                return plan

    return None


def plan_to_dict(plan: RegionActionPlan) -> dict:
    """Convert plan to JSON-serializable dict for API response."""
    return {
        "region": plan.region,
        "country": plan.country,
        "event_type": plan.event_type,
        "summary": plan.summary,
        "key_actions": plan.key_actions,
        "contacts": plan.contacts,
        "sources": plan.sources,
        "urls": plan.urls,
    }
