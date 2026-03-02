"""
Municipal Climate Insurability Report Service.

Produces a single artifact linking climate risk, exposure, and insurability:
- Risk summary (flood, heat, etc.) with data sources
- Exposure (AEL, 100-year loss when available)
- Insurability (availability, terms, premium impact)
- Compliance (TCFD/OSFI B-15/EBA) from disclosure templates
- Audit trail (who, when, model versions, sources)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def _get_community_data(municipality_id: str) -> Optional[Dict[str, Any]]:
    """Resolve community from demo data or return None."""
    from src.data.demo_communities import DEMO_COMMUNITIES, TEXAS_COMMUNITIES
    all_communities = {**DEMO_COMMUNITIES, **TEXAS_COMMUNITIES}
    return all_communities.get(municipality_id) if municipality_id else None


def _get_risk_data(municipality_id: str, community: Dict[str, Any]) -> Dict[str, Any]:
    """Get risk metrics for municipality (uses community/risk logic)."""
    from src.api.v1.endpoints.cadapt import _risk_metrics_for_city, _community_for_request

    comm = _community_for_request(municipality_id)
    cid = comm.get("id") or municipality_id or "bastrop_tx"
    pop = comm.get("population") or 12847
    return _risk_metrics_for_city(cid, pop)


async def _get_climate_exposure(municipality_id: str, lat: float, lon: float) -> Dict[str, Any]:
    """Get climate assessment for insurability context."""
    try:
        from src.services.climate_service import climate_service, ClimateScenario
        assessment = await climate_service.get_climate_assessment(
            latitude=lat, longitude=lon,
            scenario=ClimateScenario.SSP245, time_horizon=2050,
        )
        hazards = []
        for attr in ("flood", "heat_stress", "wind", "wildfire", "drought", "sea_level_rise"):
            exp = getattr(assessment, attr, None)
            if exp:
                hazards.append({
                    "type": attr.replace("_", " "),
                    "score": exp.score,
                    "probability": exp.probability,
                    "data_source": getattr(exp, "data_source", "climate_service"),
                })
        return {
            "climate_hazards": hazards,
            "composite_score": assessment.composite_score,
            "data_sources": assessment.data_sources or [],
            "confidence": assessment.confidence,
        }
    except Exception as e:
        logger.debug("Climate assessment failed: %s", e)
        return {"climate_hazards": [], "data_sources": [], "confidence": 0.5}


def _get_insurability_indicators(risk_score: float, exposure_m: float) -> Dict[str, Any]:
    """Derive insurability indicators from risk and exposure."""
    from src.services.financial_models import financial_model_service
    sum_insured = exposure_m * 1_000_000 * 2
    prem = financial_model_service.calculate_insurance_premium(
        base_rate=0.005, risk_score=risk_score, sum_insured=sum_insured, deductible=sum_insured * 0.01,
    )
    availability = "standard" if risk_score < 70 else "limited" if risk_score < 85 else "restricted"
    recs = [r for r in [
        "Consider flood mitigation measures to improve insurability" if risk_score > 60 else None,
        "Document adaptation plans for insurer negotiations" if risk_score > 50 else None,
    ] if r]
    return {
        "availability": availability,
        "premium_impact_score": round(risk_score / 100.0, 2),
        "estimated_premium_baseline_m": round(prem.annual_premium / 1_000_000, 3),
        "recommendations": recs,
    }


def _get_disclosure_compliance(municipality_name: str, framework: str = "TCFD") -> Dict[str, Any]:
    """Get disclosure package summary for compliance section."""
    try:
        from src.services.audit_extension import audit_extension_service, REGULATORY_FRAMEWORKS
        fw = REGULATORY_FRAMEWORKS.get(framework)
        if not fw:
            return {"framework": framework, "status": "unknown", "sections": []}
        package = audit_extension_service.generate_disclosure_package(
            framework=framework,
            organization=municipality_name,
            reporting_period=f"{datetime.now(timezone.utc).year}-01-01 to {datetime.now(timezone.utc).year}-12-31",
        )
        return {
            "framework": framework,
            "framework_name": fw["name"],
            "compliance_score": package.get("compliance_score", 0),
            "sections_count": len(package.get("sections") or []),
            "chain_integrity": package.get("chain_integrity", {}),
        }
    except Exception as e:
        logger.debug("Disclosure package failed: %s", e)
        return {"framework": framework, "status": "error", "error": str(e)}


async def generate_municipal_insurability_report(
    municipality_id: str,
    period: Optional[str] = None,
    hazards_filter: Optional[List[str]] = None,
    actor: str = "system",
) -> Dict[str, Any]:
    """
    Generate Municipal Climate Insurability Report.

    Args:
        municipality_id: Community ID (e.g. bastrop_tx, DE-2950159)
        period: Reporting period (default: current year)
        hazards_filter: Optional list of hazard types to include
        actor: Audit actor (user id or system)

    Returns:
        Report dict with hazards, exposure, insurability, compliance, audit_trail
    """
    now = datetime.now(timezone.utc)
    period = period or f"{now.year}-01-01 to {now.year}-12-31"

    community = _get_community_data(municipality_id)
    if not community:
        comm = {"id": municipality_id, "name": municipality_id.replace("_", " "), "population": 30000, "lat": 30.0, "lng": -97.0}
    else:
        comm = community

    mun_name = comm.get("name", municipality_id.replace("_", " "))
    lat = comm.get("lat", 30.0)
    lon = comm.get("lng", -97.0)

    risk_data = _get_risk_data(municipality_id, comm)
    hazards_raw = risk_data.get("hazards", [])
    if hazards_filter:
        hazards_raw = [h for h in hazards_raw if h.get("type") in hazards_filter]
    hazards = [{"type": h.get("type"), "score": h.get("score", 0), "level": h.get("level", "medium"), "source": "community_risk"} for h in hazards_raw]

    climate = await _get_climate_exposure(municipality_id, lat, lon)
    composite_risk = risk_data.get("financial_exposure", {}).get("annual_expected_loss_m") or 4.0
    risk_score = min(100, sum(h.get("score", 0) for h in hazards) / max(1, len(hazards))) if hazards else 50.0
    insurability = _get_insurability_indicators(risk_score, composite_risk)

    compliance = _get_disclosure_compliance(mun_name)

    model_versions = {
        "risk_model": "v2",
        "climate_service": "1.0",
        "financial_models": "1.0",
    }
    data_sources = [
        "community_risk",
        "climate_service",
        "financial_models",
        "audit_extension",
    ] + (climate.get("data_sources") or [])

    audit_trail = [
        {
            "timestamp": now.isoformat(),
            "action": "generate_insurability_report",
            "actor": actor,
            "municipality_id": municipality_id,
            "model_versions": model_versions,
        }
    ]

    exposure = risk_data.get("financial_exposure") or {
        "annual_expected_loss_m": composite_risk,
        "loss_100_year_m": composite_risk * 15,
        "projected_2050_m": composite_risk * 1.6,
    }

    roi_metrics = {}
    try:
        from src.services.municipal_roi_metrics import get_roi_metrics
        roi_metrics = await get_roi_metrics(municipality_id, period="12m")
    except Exception as e:
        logger.debug("ROI metrics in report failed: %s", e)

    return {
        "municipality_id": municipality_id,
        "municipality_name": mun_name,
        "period": period,
        "generated_at": now.isoformat(),
        "hazards": hazards,
        "exposure": exposure,
        "insurability": insurability,
        "compliance": compliance,
        "audit_trail": audit_trail,
        "model_versions": model_versions,
        "data_sources": list(dict.fromkeys(data_sources)),
        "roi_evidence": roi_metrics,
    }
