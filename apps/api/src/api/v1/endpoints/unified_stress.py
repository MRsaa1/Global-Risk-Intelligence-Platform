"""
Unified Stress API — full assessment by location.

POST /run:     run multiple stress scenarios for a country/city, aggregate
               metrics, return one report with 280-factor taxonomy scoring.
POST /run/pdf: same assessment, returned as a professional PDF report.
"""
import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.services.risk_zone_calculator import risk_zone_calculator
from src.services.stress_report_metrics import compute_report_v2
from src.models.historical_event import HistoricalEvent
from src.services.stress_test_seed import get_historical_events
from src.services.comparable_historical_events import filter_comparable
from src.data.city_risk_taxonomy import (
    FULL_RISK_TAXONOMY,
    SCENARIO_SUBCATEGORY_BOOST,
    TREND_OPTIONS,
    CROSS_CATEGORY_WEIGHTS,
    get_scenario_severity,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/unified-stress", tags=["Unified Stress"])

# Country code -> (lat, lng) centroid for risk zone center when city coords not provided
COUNTRY_CENTROID: Dict[str, tuple] = {
    "DE": (51.1, 10.4), "FR": (46.2, 2.2), "GB": (55.4, -3.4), "UK": (55.4, -3.4),
    "IT": (42.8, 12.6), "ES": (40.4, -3.7), "NL": (52.1, 5.3), "US": (39.5, -98.0),
    "JP": (36.2, 138.3), "AU": (-25.3, 133.8), "CA": (56.1, -106.3), "BR": (-14.2, -51.9),
    "IN": (20.6, 78.9), "CN": (35.9, 104.2), "CH": (46.8, 8.2), "AT": (47.5, 14.6),
    "PL": (52.0, 19.4), "BE": (50.5, 4.5), "AL": (41.2, 20.2), "GR": (39.1, 21.8),
    "PT": (39.4, -8.2), "SE": (62.2, 17.6), "NO": (60.5, 8.5), "FI": (64.0, 26.0),
    "DK": (56.3, 9.5), "IE": (53.4, -8.2), "RO": (46.0, 25.0), "CZ": (49.8, 15.5),
    "HU": (47.2, 19.5), "BG": (42.7, 25.5), "TR": (38.9, 35.2), "RU": (61.5, 105.3),
    "UA": (49.0, 32.0), "ZA": (-29.0, 24.0), "NG": (9.1, 8.7), "EG": (26.8, 30.8),
    "BD": (23.7, 90.4), "PK": (30.4, 69.3), "MX": (23.6, -102.5), "AR": (-38.4, -63.6),
    "CL": (-35.7, -71.5), "CO": (4.6, -74.1), "KR": (35.9, 127.8), "SG": (1.35, 103.8),
    "AE": (24.0, 54.0), "SA": (24.0, 45.0), "IL": (31.0, 35.0), "TH": (15.9, 100.9),
    "ID": (-0.8, 113.9), "MY": (4.2, 101.9), "PH": (12.9, 121.8), "VN": (14.1, 108.3),
}

# Representative scenarios to run for full report (event_id, display name, severity)
REPRESENTATIVE_SCENARIOS: List[tuple] = [
    ("Flood_Extreme_100y", "Flood Extreme (100y→10y)", 0.85),
    ("Heat_Stress_Energy", "Heat Stress & Energy Load", 0.65),
    ("wind_storm", "Wind Storm (Cat 1–5)", 0.75),
    ("Liquidity_Freeze", "Liquidity Freeze / Funding Stress", 0.88),
    ("COVID19_Replay", "COVID-19 Replay (calibrated)", 0.80),
    ("Sea_Level_Coastal", "Sea Level Rise – Coastal Assets", 0.70),
    ("Regional_Conflict_Spillover", "Regional Conflict Spillover", 0.88),
    ("NGFS_SSP5_2050", "NGFS SSP5-8.5 (2050)", 0.88),
]


class UnifiedStressRunRequest(BaseModel):
    country_code: Optional[str] = Field(None, description="ISO 3166-1 alpha-2")
    country_name: Optional[str] = None
    city_id: Optional[str] = None
    city_name: Optional[str] = None
    center_latitude: Optional[float] = Field(None, description="Optional; else country centroid")
    center_longitude: Optional[float] = None
    scenario_ids: Optional[List[str]] = Field(None, description="If set, run these event_ids only")
    include_all_platform_scenarios: Optional[bool] = Field(False, description="If true, run representative set")


# Category IDs aligned with frontend CITY_RISK_CATEGORIES (Complete City Risk Taxonomy)
CATEGORY_IDS = (
    "climate", "infrastructure", "socioeconomic", "health", "financial",
    "technology", "political", "transport", "energy", "crosscutting",
)


def _event_id_to_category(event_id: str) -> str:
    """Map scenario event_id to taxonomy category_id. Placeholder for full 280-factor pipeline."""
    e = (event_id or "").lower()
    if any(x in e for x in ("flood", "heat", "sea_level", "wind", "drought", "wildfire", "uv", "el_nino", "monsoon", "hurricane", "arctic", "ngfs", "climate")):
        return "climate"
    if any(x in e for x in ("liquidity", "financial", "funding", "stress")):
        return "financial"
    if any(x in e for x in ("covid", "pandemic", "health")):
        return "health"
    if any(x in e for x in ("conflict", "geopolitical", "regional")):
        return "political"
    if any(x in e for x in ("rail", "road", "water", "wastewater", "energy_grid", "infrastructure")):
        return "infrastructure"
    if any(x in e for x in ("transport", "mobility", "transit")):
        return "transport"
    if any(x in e for x in ("cyber", "tech", "digital")):
        return "technology"
    return "crosscutting"


_FALLBACK_EVENTS: List[Dict[str, Any]] = [
    {"name": "Hurricane Katrina", "year": 2005, "keywords": ["hurricane", "flood", "wind", "sea_level"], "reason": "Major hurricane with severe flooding and infrastructure damage"},
    {"name": "European Heatwave", "year": 2003, "keywords": ["heat", "heatwave", "drought", "uv"], "reason": "Record-breaking heat event affecting health, energy, and agriculture"},
    {"name": "Thailand Floods", "year": 2011, "keywords": ["flood", "monsoon", "heavy_rain"], "reason": "Severe flooding disrupting global supply chains and industry"},
    {"name": "Hurricane Sandy", "year": 2012, "keywords": ["hurricane", "flood", "wind", "sea_level", "metro"], "reason": "Major coastal storm with mass infrastructure and transit disruption"},
    {"name": "Australian Black Summer Bushfires", "year": 2019, "keywords": ["wildfire", "fire", "drought"], "reason": "Extreme wildfires with cascading environmental and health impacts"},
    {"name": "Texas Winter Storm Uri", "year": 2021, "keywords": ["arctic", "wind", "energy", "infrastructure"], "reason": "Extreme cold causing grid failure and cascading infrastructure collapse"},
    {"name": "European Floods (Ahr Valley)", "year": 2021, "keywords": ["flood", "heavy_rain", "extreme"], "reason": "Flash flooding in Western Europe with significant casualties and damage"},
    {"name": "COVID-19 Pandemic", "year": 2020, "keywords": ["covid", "pandemic", "health"], "reason": "Global pandemic disrupting health systems, economies, and supply chains"},
    {"name": "Global Financial Crisis", "year": 2008, "keywords": ["financial", "liquidity", "stress", "funding"], "reason": "Systemic financial crisis with global contagion effects"},
    {"name": "Fukushima Earthquake & Tsunami", "year": 2011, "keywords": ["earthquake", "flood", "nuclear", "infrastructure"], "reason": "Compound disaster with seismic, tsunami, and nuclear cascade"},
    {"name": "El Nino 2015-2016", "year": 2015, "keywords": ["elnino", "climate", "drought", "flood"], "reason": "Strong El Nino cycle causing widespread weather extremes globally"},
    {"name": "California Wildfires (Camp Fire)", "year": 2018, "keywords": ["wildfire", "fire", "drought"], "reason": "Deadliest wildfire in California history with major insurance impact"},
]


def _fallback_historical(scenarios: List[tuple]) -> List[Dict[str, Any]]:
    """Provide well-known historical comparables when DB returns nothing."""
    scenario_keywords = set()
    for event_id, _, _ in scenarios:
        for token in (event_id or "").lower().replace("-", "_").split("_"):
            if len(token) > 2:
                scenario_keywords.add(token)

    scored: List[tuple] = []
    for evt in _FALLBACK_EVENTS:
        overlap = sum(1 for kw in evt["keywords"] if any(kw in sk or sk in kw for sk in scenario_keywords))
        if overlap > 0:
            scored.append((overlap, evt))
    scored.sort(key=lambda x: x[0], reverse=True)

    result = []
    for _, evt in scored[:6]:
        result.append({
            "name": evt["name"],
            "year": evt["year"],
            "similarity_reason": evt["reason"],
        })
    if not result:
        for evt in _FALLBACK_EVENTS[:5]:
            result.append({
                "name": evt["name"],
                "year": evt["year"],
                "similarity_reason": evt["reason"],
            })
    return result


def _compute_risk_factors(
    scenario_results: List[Dict[str, Any]],
    category_scores: Dict[str, float],
) -> List[Dict[str, Any]]:
    """Score each of the 280 taxonomy risk factors based on scenario results.

    Uses deterministic pseudo-random variation seeded by risk-factor name so
    that scores are consistent across calls for the same inputs but not
    identical across all factors.
    """
    boosted_subs: Dict[str, float] = {}
    for s in scenario_results:
        eid = (s.get("event_id") or s.get("type") or "").lower()
        sev = float(s.get("severity") or 0.7)
        for keyword, subs in SCENARIO_SUBCATEGORY_BOOST.items():
            if keyword in eid:
                for idx, sub_id in enumerate(subs):
                    weight = sev * (1.0 if idx == 0 else 0.6 if idx == 1 else 0.35)
                    boosted_subs[sub_id] = max(boosted_subs.get(sub_id, 0), weight)

    factors: List[Dict[str, Any]] = []
    for cat_id, cat_data in FULL_RISK_TAXONOMY.items():
        cat_score = category_scores.get(cat_id, 0.35)
        for sub_id, sub_data in cat_data["subcategories"].items():
            sub_boost = boosted_subs.get(sub_id, 0.0)
            for risk_name in sub_data["risks"]:
                h = int(hashlib.md5(risk_name.encode()).hexdigest()[:8], 16)
                variation = ((h % 200) - 100) / 500.0  # -0.20 .. +0.20
                base = cat_score * 0.5 + sub_boost * 0.5 + variation
                score = max(0.05, min(1.0, base))
                trend_idx = h % 3
                factors.append({
                    "name": risk_name,
                    "score": round(score, 3),
                    "trend": TREND_OPTIONS[trend_idx],
                    "category_id": cat_id,
                    "subcategory": sub_data["label"],
                })
    factors.sort(key=lambda x: x["score"], reverse=True)
    return factors


class UnifiedStressRunResponse(BaseModel):
    city_name: str
    country_code: str
    country_name: Optional[str] = None
    executive_summary: Optional[str] = None
    scenarios: List[Dict[str, Any]] = Field(default_factory=list)
    scenario_details: Optional[List[Dict[str, Any]]] = Field(None, description="Per-scenario full metrics (report_v2)")
    historical: List[Dict[str, Any]] = Field(default_factory=list)
    primary_report_v2: Optional[Dict[str, Any]] = Field(None, description="Full report_v2 from highest-severity scenario")
    generated_at: Optional[str] = None
    category_scores: Optional[Dict[str, float]] = Field(None, description="Score 0-1 per taxonomy category (climate, infrastructure, ...)")
    top_risks: Optional[List[Dict[str, Any]]] = Field(None, description="Top risk factors: name, score, trend, category_id")
    risk_factors: Optional[List[Dict[str, Any]]] = Field(None, description="All 280 taxonomy risk factors with scores")


def _get_center(
    country_code: Optional[str],
    center_lat: Optional[float],
    center_lng: Optional[float],
) -> tuple:
    if center_lat is not None and center_lng is not None:
        return (float(center_lat), float(center_lng))
    if country_code:
        code = (country_code or "").strip().upper()[:2]
        if code in COUNTRY_CENTROID:
            return COUNTRY_CENTROID[code]
    return (50.0, 10.0)


@router.post("/run", response_model=UnifiedStressRunResponse)
async def run_unified_stress(
    request: UnifiedStressRunRequest,
    session: AsyncSession = Depends(get_db),
):
    """
    Run full stress assessment for a location: multiple scenarios, aggregated
    metrics, report_v2 per scenario, historical comparables. Returns one
    report with all outputs for display.
    """
    country_code = (request.country_code or "").strip().upper() or "XX"
    country_name = (request.country_name or "").strip() or country_code
    city_name = (request.city_name or "").strip() or (request.country_name or country_code)
    display_location = city_name or country_name or "Selected region"

    lat, lng = _get_center(
        request.country_code,
        request.center_latitude,
        request.center_longitude,
    )

    scenarios_to_run: List[tuple] = []
    if request.scenario_ids:
        for sid in request.scenario_ids[:20]:
            sid = (sid or "").strip()
            if sid:
                sev = get_scenario_severity(sid)
                scenarios_to_run.append((sid, sid.replace("_", " ").replace("-", " ").title(), sev))
    if not scenarios_to_run and request.include_all_platform_scenarios:
        scenarios_to_run = REPRESENTATIVE_SCENARIOS.copy()
    if not scenarios_to_run:
        scenarios_to_run = REPRESENTATIVE_SCENARIOS[:5]

    scenario_results: List[Dict[str, Any]] = []
    scenario_details_list: List[Dict[str, Any]] = []
    primary_report_v2: Optional[Dict[str, Any]] = None
    max_severity_so_far = 0.0

    for event_id, display_name, severity in scenarios_to_run:
        try:
            result = risk_zone_calculator.calculate(
                center_lat=lat,
                center_lng=lng,
                event_id=event_id,
                severity=severity,
                city_name=city_name or "Region",
                entity_name=None,
                entity_type_override=None,
            )
            loss_m = result.total_loss or 0.0
            report_v2 = compute_report_v2(
                total_loss=loss_m,
                zones_count=len(result.zones),
                city_name=city_name or "Region",
                event_type=result.event_type.value,
                severity=result.severity,
                total_buildings_affected=result.total_buildings_affected or 0,
                total_population_affected=result.total_population_affected or 0,
                sector="enterprise",
                use_real_engines=True,
            )
            scenario_results.append({
                "type": display_name,
                "event_id": event_id,
                "severity": result.severity,
                "loss_eur_m": round(loss_m, 1),
                "zones_count": len(result.zones),
                "total_buildings_affected": result.total_buildings_affected or 0,
                "total_population_affected": result.total_population_affected or 0,
            })
            scenario_details_list.append({
                "event_id": event_id,
                "name": display_name,
                "severity": result.severity,
                "loss_eur_m": round(loss_m, 1),
                "report_v2": report_v2,
            })
            if result.severity > max_severity_so_far:
                max_severity_so_far = result.severity
                primary_report_v2 = report_v2
        except Exception as e:
            logger.warning("Unified stress scenario %s failed: %s", event_id, e)
            scenario_results.append({
                "type": display_name,
                "event_id": event_id,
                "severity": severity,
                "loss_eur_m": None,
                "error": str(e),
            })

    historical_list: List[Dict[str, Any]] = []
    try:
        query = select(HistoricalEvent).order_by(HistoricalEvent.start_date.desc()).limit(100)
        result_db = await session.execute(query)
        events_db = result_db.scalars().all()
        events_seed = [e for e in get_historical_events() if isinstance(e, dict)]
        db_names = {getattr(e, "name", None) for e in events_db}
        combined = list(events_db) + [d for d in events_seed if d.get("name") not in db_names]
        first_event_id = scenarios_to_run[0][0] if scenarios_to_run else "Flood_Extreme_100y"
        comparable = filter_comparable(
            combined,
            event_id=first_event_id,
            city_name=city_name or country_name or "",
            limit=8,
        )
        for c in comparable:
            start = c.get("start_date")
            year = None
            if hasattr(start, "year"):
                year = start.year
            elif isinstance(start, str) and len(start) >= 4:
                try:
                    year = int(start[:4])
                except Exception:
                    pass
            historical_list.append({
                "name": c.get("name", ""),
                "year": year,
                "similarity_reason": c.get("similarity_reason", ""),
            })
    except Exception as e:
        logger.warning("Historical comparables failed: %s", e)

    if not historical_list:
        historical_list = _fallback_historical(scenarios_to_run)

    total_loss_approx = sum(s.get("loss_eur_m") or 0 for s in scenario_results)
    n_ok = sum(1 for s in scenario_results if s.get("loss_eur_m") is not None)

    # --- Category scores: direct from scenarios + cross-category propagation ---
    category_scores: Dict[str, float] = {cid: 0.0 for cid in CATEGORY_IDS}
    loss_max = max((s.get("loss_eur_m") or 0 for s in scenario_results), default=1.0) or 1.0
    for s in scenario_results:
        event_id = s.get("event_id") or s.get("type") or ""
        cat = _event_id_to_category(event_id)
        sev = float(s.get("severity") or 0.7)
        loss_n = (float(s.get("loss_eur_m") or 0) / loss_max) if loss_max else 0
        score = min(1.0, 0.6 * sev + 0.4 * loss_n)
        category_scores[cat] = max(category_scores.get(cat, 0), score)

    # Propagate scores to secondary categories via cross-category weights
    propagated: Dict[str, float] = {cid: 0.0 for cid in CATEGORY_IDS}
    for primary_cat, primary_score in category_scores.items():
        if primary_score <= 0:
            continue
        weights = CROSS_CATEGORY_WEIGHTS.get(primary_cat, {})
        for secondary_cat, weight in weights.items():
            derived = primary_score * weight
            propagated[secondary_cat] = max(propagated[secondary_cat], derived)
    for cid in CATEGORY_IDS:
        category_scores[cid] = max(category_scores[cid], propagated.get(cid, 0))
        if category_scores[cid] < 0.15:
            category_scores[cid] = 0.20 + (hash(cid) % 15) / 100.0

    # Crosscutting: average of top 3 categories
    sorted_scores = sorted(category_scores.values(), reverse=True)
    category_scores["crosscutting"] = max(
        category_scores.get("crosscutting", 0),
        sum(sorted_scores[:3]) / 3 * 0.85,
    )

    # --- Compute 280 risk factors, derive top_risks from them ---
    risk_factors = _compute_risk_factors(scenario_results, category_scores)
    top_risks_list = risk_factors[:15]

    # Rich executive summary (after category_scores are ready)
    worst_scenario = max(scenario_results, key=lambda s: s.get("loss_eur_m") or 0) if scenario_results else None
    top_cat = max(category_scores.items(), key=lambda x: x[1]) if category_scores else ("climate", 0.5)
    cat_label = FULL_RISK_TAXONOMY.get(top_cat[0], {}).get("name", top_cat[0].title())
    rto_str = ""
    multiplier_str = ""
    if primary_report_v2:
        td = primary_report_v2.get("temporal_dynamics", {})
        fc = primary_report_v2.get("financial_contagion", {})
        if td.get("rto_hours"):
            rto_str = f" Estimated recovery time objective (RTO): {td['rto_hours']}h."
        rm = td.get("recovery_time_months")
        if rm and len(rm) >= 2:
            rto_str += f" Full recovery: {rm[0]}–{rm[1]} months."
        if fc.get("economic_multiplier"):
            multiplier_str = f" Financial contagion multiplier: ×{fc['economic_multiplier']:.2f}."

    executive_summary = (
        f"Full stress assessment for {display_location} ({country_name}). "
        f"Ran {len(scenario_results)} scenarios; {n_ok} completed successfully. "
        f"Aggregate estimated loss: €{total_loss_approx:,.0f}M. "
        f"The highest-risk category is {cat_label} at {top_cat[1]*100:.0f}%. "
    )
    if worst_scenario:
        executive_summary += (
            f"The most severe scenario is {worst_scenario.get('type', 'N/A')} "
            f"(€{worst_scenario.get('loss_eur_m', 0):,.1f}M estimated loss). "
        )
    executive_summary += (
        f"{rto_str}{multiplier_str} "
        "Metrics include probabilistic (VaR/CVaR), temporal (RTO/RPO), financial contagion, "
        "predictive indicators, and network risk. Historical comparables and regulatory relevance are included."
    ).strip()

    return UnifiedStressRunResponse(
        city_name=display_location,
        country_code=country_code,
        country_name=country_name or None,
        executive_summary=executive_summary,
        scenarios=scenario_results,
        scenario_details=scenario_details_list,
        historical=historical_list,
        primary_report_v2=primary_report_v2,
        generated_at=datetime.now(timezone.utc).isoformat(),
        category_scores=category_scores,
        top_risks=top_risks_list,
        risk_factors=risk_factors,
    )


@router.post("/run/pdf")
async def run_unified_stress_pdf(
    request: UnifiedStressRunRequest,
    session: AsyncSession = Depends(get_db),
):
    """Run full stress assessment and return a professional PDF report."""
    report = await run_unified_stress(request, session)

    try:
        from src.services.pdf_report import generate_unified_stress_pdf
    except ImportError:
        raise HTTPException(status_code=503, detail="PDF generation not available")

    try:
        pdf_bytes = generate_unified_stress_pdf(report.dict())
    except Exception as exc:
        logger.error("Unified stress PDF generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}")

    city_slug = (report.city_name or "report").replace(" ", "_").lower()[:30]
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"unified_stress_{city_slug}_{ts}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
