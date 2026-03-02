"""
Cross-Module Cascade Engine API (P1)
======================================

Endpoints for cross-module cascade simulation, dependency graph visualization,
EP curve data, risk velocity, Bayesian network inference, auto-recommendations,
and new data source integrations (Sentinel Hub, WHO, CISA KEV).
"""
import logging
import time
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory cache for EP curve: same params return instantly (TTL 5 min)
_ep_curve_cache: Dict[str, Tuple[float, Any]] = {}
_EP_CURVE_CACHE_TTL_SEC = 300


# ── Pydantic schemas ──────────────────────────────────────────────────

class CascadeEventRequest(BaseModel):
    source_module: str = Field("cip", description="Source module: cip, scss, sro, biosec, erf, asm, asgi, cadapt")
    category: str = Field("infrastructure_failure", description="Event category")
    severity: float = Field(0.5, ge=0, le=1)
    description: str = ""

class BayesianInferenceRequest(BaseModel):
    query: str = Field("portfolio_loss_severity", description="Variable to query")
    evidence: dict = Field(default_factory=dict, description="Observed evidence {var: state}")


class BayesianAnalyzeRequest(BaseModel):
    """Request body for full Bayesian network analysis."""
    evidence: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Observed evidence {var: state or 0-3}")

class AutoRecommendationRequest(BaseModel):
    scenario_type: str = Field("flood", description="Scenario type")
    total_loss_m: float = Field(100.0, description="Total estimated loss in €M")
    severity: float = Field(0.5, ge=0, le=1)
    affected_zones: list = Field(default_factory=list)
    affected_modules: list = Field(default_factory=list)
    stress_test_id: Optional[str] = None


# ── P1: Cross-Module Cascade ─────────────────────────────────────────

@router.post("/cascade/simulate")
async def simulate_cascade(req: CascadeEventRequest):
    """Simulate cross-module cascade propagation from a triggering event."""
    from src.services.cross_module_cascade import (
        CascadeEvent, EventCategory, RiskModule, cascade_engine,
    )
    try:
        source = RiskModule(req.source_module)
    except ValueError:
        raise HTTPException(400, f"Unknown module: {req.source_module}")
    try:
        category = EventCategory(req.category)
    except ValueError:
        raise HTTPException(400, f"Unknown category: {req.category}")

    event = CascadeEvent(
        source_module=source,
        category=category,
        severity=req.severity,
        description=req.description,
    )
    result = cascade_engine.simulate_cascade(event)
    return result.to_dict()


@router.get("/cascade/graph")
async def get_cascade_graph():
    """Return the full cross-module dependency graph for visualization."""
    from src.services.cross_module_cascade import cascade_engine
    return cascade_engine.get_dependency_graph()


# ── P2b: EP Curve ────────────────────────────────────────────────────

def _ep_curve_cache_key(
    total_exposure_m: float,
    n_assets: int,
    sector: str,
    scenario_type: str,
    severity: float,
    n_simulations: int,
) -> str:
    """Stable key for EP curve cache (round exposure and severity for reuse)."""
    return f"{round(total_exposure_m):.0f}|{n_assets}|{sector}|{scenario_type}|{round(severity, 2)}|{n_simulations}"


@router.get("/ep-curve")
async def get_ep_curve(
    total_exposure_m: float = Query(500, description="Total exposure in €M"),
    n_assets: int = Query(50),
    sector: str = Query("enterprise"),
    scenario_type: str = Query("climate"),
    severity: float = Query(0.5, ge=0, le=1),
    n_simulations: int = Query(100_000, ge=1000, le=500_000),
):
    """
    Generate Exceedance Probability (EP) curve from Monte Carlo simulation.
    Returns percentile → loss mapping for plotting.
    Cached for 5 minutes by (exposure, n_assets, sector, scenario_type, severity, n_simulations)
    so repeated Dashboard loads with same params draw instantly.
    """
    cache_key = _ep_curve_cache_key(total_exposure_m, n_assets, sector, scenario_type, severity, n_simulations)
    now = time.time()
    if cache_key in _ep_curve_cache:
        cached_at, payload = _ep_curve_cache[cache_key]
        if now - cached_at < _EP_CURVE_CACHE_TTL_SEC:
            return payload
        del _ep_curve_cache[cache_key]

    from src.services.universal_stress_engine import compute_monte_carlo_metrics
    metrics = compute_monte_carlo_metrics(
        total_exposure=total_exposure_m,
        n_assets=n_assets,
        sector=sector,
        scenario_type=scenario_type,
        severity=severity,
        n_simulations=n_simulations,
    )
    # Build EP curve: exceedance probability at each loss level
    percentiles = metrics.get("percentiles", {})
    ep_curve = []
    for key in ["p5", "p10", "p25", "p50", "p75", "p90", "p95", "p99"]:
        if key in percentiles:
            pct = int(key.replace("p", ""))
            ep_curve.append({
                "percentile": pct,
                "exceedance_probability": round((100 - pct) / 100, 2),
                "loss_m": round(percentiles[key] / 1e6, 2) if percentiles[key] > 10000 else round(percentiles[key], 2),
            })

    payload = {
        "ep_curve": ep_curve,
        "var_95_m": metrics.get("var_95", 0),
        "var_99_m": metrics.get("var_99", 0),
        "cvar_99_m": metrics.get("cvar_99", 0),
        "mean_loss_m": metrics.get("mean_loss", 0),
        "max_loss_m": metrics.get("max_loss", 0),
        "monte_carlo_runs": n_simulations,
        "methodology": metrics.get("methodology", ""),
        "inputs": {
            "total_exposure_m": total_exposure_m,
            "n_assets": n_assets,
            "sector": sector,
            "scenario_type": scenario_type,
            "severity": severity,
        },
    }
    _ep_curve_cache[cache_key] = (now, payload)
    return payload


# ── P2a: Risk Velocity ───────────────────────────────────────────────

@router.get("/risk-velocity")
async def get_risk_velocity(db: AsyncSession = Depends(get_db)):
    """
    Get real-time risk velocity (MoM, WoW, trend direction).
    Uses risk_posture_snapshots when available; otherwise synthetic fallback so UI always has a value.
    """
    from datetime import datetime, timedelta
    from sqlalchemy import text

    from src.services.time_series_forecast import forecaster

    SNAPSHOT_TABLE = "risk_posture_snapshots"
    dates = []
    values = []

    try:
        result = await db.execute(
            text(
                f"""
                SELECT snapshot_date, at_risk_exposure
                FROM {SNAPSHOT_TABLE}
                ORDER BY snapshot_date ASC
                LIMIT 365
                """
            ),
        )
        rows = result.fetchall()
        for r in rows:
            d = r[0]
            if d is None:
                continue
            if hasattr(d, "year") and hasattr(d, "month"):
                if isinstance(d, datetime):
                    dates.append(d)
                else:
                    dates.append(datetime.combine(d, datetime.min.time()))
            else:
                dates.append(datetime.fromisoformat(str(d).replace("Z", "+00:00")))
            values.append(float(r[1]) if r[1] is not None else 0.0)
    except Exception:
        pass

    if len(dates) >= 2 and len(values) >= 2:
        # Real MoM: simple (last - prev) / prev * 100 when only 2 points; else use forecaster
        if len(values) >= 31:
            velocity = forecaster.compute_risk_velocity(dates, values)
        else:
            prev = values[-2] if abs(values[-2]) >= 1e-10 else 1.0
            mom_pct = round((values[-1] - values[-2]) / prev * 100, 2)
            wow_pct = round((values[-1] - values[-2]) / prev * 100, 2) if len(values) >= 2 else mom_pct
            direction = "increasing" if mom_pct > 5 else "decreasing" if mom_pct < -5 else "stable"
            velocity = {
                "mom_pct": mom_pct,
                "wow_pct": wow_pct,
                "direction": direction,
                "current": values[-1],
                "previous_month": values[-2],
                "previous_week": values[-2],
            }
        forecast_result = forecaster.forecast(dates, values, horizon_days=30, variable_name="at_risk_exposure")
        return {
            "risk_velocity": velocity,
            "forecast": forecast_result.to_dict(),
        }
    else:
        # No snapshot data: return deterministic 0% MoM so Command Center and Dashboard show the same value (no random per request)
        velocity = {
            "mom_pct": 0.0,
            "wow_pct": 0.0,
            "direction": "stable",
            "current": 0,
            "previous_month": 0,
            "previous_week": 0,
        }
        return {
            "risk_velocity": velocity,
            "forecast": {"variable_name": "at_risk_exposure", "historical_points": 0, "forecast": [], "trend": {"direction": "unknown", "slope": 0, "r_squared": 0}},
        }


# ── P4a: Auto-Recommendations ────────────────────────────────────────

@router.post("/recommendations/generate")
async def generate_recommendations(req: AutoRecommendationRequest):
    """Generate auto-recommendations based on stress test results."""
    from src.services.auto_recommendation_engine import generate_action_plan
    plan = generate_action_plan(
        scenario_type=req.scenario_type,
        total_loss_m=req.total_loss_m,
        severity=req.severity,
        affected_zones=req.affected_zones,
        affected_modules=req.affected_modules,
        stress_test_id=req.stress_test_id,
    )
    return plan.to_dict()


# ── P5a: Bayesian Network ────────────────────────────────────────────

@router.post("/bayesian/infer")
async def bayesian_inference(req: BayesianInferenceRequest):
    """Run Bayesian inference on the multi-risk network."""
    from src.services.bayesian_risk_network import bayesian_network
    try:
        result = bayesian_network.infer(req.query, req.evidence)
        return result.to_dict()
    except ValueError as e:
        raise HTTPException(400, str(e))


def _normalize_bayesian_evidence(evidence: Dict[str, Any]) -> Dict[str, str]:
    """Map numeric or string evidence to state names: low, medium, high, critical."""
    state_names = ["low", "medium", "high", "critical"]
    out: Dict[str, str] = {}
    for var, val in (evidence or {}).items():
        if val is None:
            continue
        if isinstance(val, (int, float)):
            idx = int(val)
            if 0 <= idx < len(state_names):
                out[var] = state_names[idx]
            continue
        s = str(val).strip().lower()
        if s in state_names:
            out[var] = s
        elif s in ("0", "1", "2", "3"):
            out[var] = state_names[int(s)]
    return out


@router.post("/bayesian/analyze")
async def bayesian_full_analysis(body: Optional[BayesianAnalyzeRequest] = None):
    """Analyze the full Bayesian risk network given current evidence."""
    from src.services.bayesian_risk_network import bayesian_network
    raw = (body.evidence if body is not None and body.evidence is not None else None) or {}
    evidence = _normalize_bayesian_evidence(raw)
    result = bayesian_network.analyze_full_network(evidence)
    out = result.to_dict()
    out["network_size"] = {
        "nodes": len(bayesian_network.nodes),
        "edges": sum(len(n.parents) for n in bayesian_network.nodes.values()),
    }
    return out


# ── P5b: Time-Series Forecast ────────────────────────────────────────

SNAPSHOT_TABLE_FORECAST = "risk_posture_snapshots"
# Map frontend variable to snapshot column
FORECAST_VARIABLE_COLUMN = {
    "risk_score": "weighted_risk",
    "at_risk_exposure": "at_risk_exposure",
    "total_exposure": "total_exposure",
    "weighted_risk": "weighted_risk",
}


@router.get("/forecast")
async def get_forecast(
    variable: str = Query("risk_score"),
    horizon_days: int = Query(30, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Get time-series forecast for a risk variable. Uses risk_posture_snapshots when available; otherwise synthetic fallback."""
    from datetime import datetime, timedelta

    from sqlalchemy import text

    from src.services.time_series_forecast import forecaster

    col = FORECAST_VARIABLE_COLUMN.get(variable, "weighted_risk")
    dates = []
    values = []

    try:
        result = await db.execute(
            text(
                f"""
                SELECT snapshot_date, {col}
                FROM {SNAPSHOT_TABLE_FORECAST}
                ORDER BY snapshot_date ASC
                LIMIT 365
                """
            ),
        )
        rows = result.fetchall()
        for r in rows:
            d = r[0]
            if d is None:
                continue
            if hasattr(d, "year") and hasattr(d, "month"):
                if isinstance(d, datetime):
                    dates.append(d)
                else:
                    dates.append(datetime.combine(d, datetime.min.time()))
            else:
                dates.append(datetime.fromisoformat(str(d).replace("Z", "+00:00")))
            values.append(float(r[1]) if r[1] is not None else 0.0)
    except Exception:
        pass

    if len(dates) >= 2 and len(values) >= 2:
        result = forecaster.forecast(dates, values, horizon_days=horizon_days, variable_name=variable)
        out = result.to_dict()
        out["data_source"] = "risk_posture_snapshots"
        return out

    # Fallback: synthetic series so UI always has a value
    import numpy as np

    now = datetime.utcnow()
    n_days = 90
    dates_syn = [now - timedelta(days=n_days - i) for i in range(n_days)]
    base = 45.0
    trend = np.linspace(0, 8, n_days)
    seasonal = 3 * np.sin(np.linspace(0, 4 * np.pi, n_days))
    noise = np.random.normal(0, 1.5, n_days)
    values_syn = (base + trend + seasonal + noise).tolist()

    result = forecaster.forecast(dates_syn, values_syn, horizon_days=horizon_days, variable_name=variable)
    out = result.to_dict()
    out["data_source"] = "synthetic"
    return out


# ── P3a: Sentinel Hub ────────────────────────────────────────────────

@router.get("/sentinel-hub/flood")
async def sentinel_flood_detection(
    lat: float = Query(..., description="Center latitude"),
    lng: float = Query(..., description="Center longitude"),
    radius_km: float = Query(25),
):
    """Detect flooding using Sentinel-2 satellite imagery (NDWI)."""
    import os
    from src.services.external.sentinel_hub_client import SentinelHubClient
    client = SentinelHubClient(
        client_id=os.getenv("SENTINEL_HUB_CLIENT_ID", ""),
        client_secret=os.getenv("SENTINEL_HUB_CLIENT_SECRET", ""),
    )
    result = await client.detect_flood(lat, lng, radius_km)
    return {
        "flood_area_km2": result.flood_area_km2,
        "water_fraction": result.water_fraction,
        "ndwi_mean": result.ndwi_mean,
        "confidence": result.confidence,
        "scene_date": result.scene_date,
        "success": result.success,
        "error": result.error,
    }


@router.get("/sentinel-hub/vegetation")
async def sentinel_vegetation_health(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(25),
):
    """Analyze vegetation health / drought using Sentinel-2 NDVI."""
    import os
    from src.services.external.sentinel_hub_client import SentinelHubClient
    client = SentinelHubClient(
        client_id=os.getenv("SENTINEL_HUB_CLIENT_ID", ""),
        client_secret=os.getenv("SENTINEL_HUB_CLIENT_SECRET", ""),
    )
    result = await client.analyze_vegetation(lat, lng, radius_km)
    return {
        "ndvi_current": result.ndvi_current,
        "ndvi_baseline": result.ndvi_baseline,
        "ndvi_anomaly": result.ndvi_anomaly,
        "drought_severity": result.drought_severity,
        "burned_area_fraction": result.burned_area_fraction,
        "scene_date": result.scene_date,
        "success": result.success,
    }


# ── P3b: WHO Disease Outbreaks ───────────────────────────────────────

@router.get("/who/outbreaks")
async def get_who_outbreaks(
    days_back: int = Query(90, le=365),
    disease: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
):
    """Fetch WHO Disease Outbreak News for BIOSEC module."""
    from src.services.external.who_outbreak_client import fetch_who_outbreaks
    summary = await fetch_who_outbreaks(days_back, disease, country)
    return summary.to_dict()


# ── P3c: CISA KEV / MITRE ATT&CK ────────────────────────────────────

@router.get("/cyber/kev")
async def get_cisa_kev(days_back: int = Query(90, le=365)):
    """Fetch CISA Known Exploited Vulnerabilities catalog."""
    from src.services.external.cisa_kev_client import fetch_cisa_kev
    summary = await fetch_cisa_kev(days_back)
    return summary.to_dict()


@router.get("/cyber/attack-techniques")
async def get_attack_techniques(tactic: Optional[str] = Query(None)):
    """Fetch MITRE ATT&CK Enterprise techniques."""
    from src.services.external.cisa_kev_client import fetch_attack_techniques
    techniques = await fetch_attack_techniques(tactic)
    return {
        "count": len(techniques),
        "techniques": [
            {"id": t.technique_id, "name": t.name, "tactic": t.tactic, "platforms": t.platforms}
            for t in techniques[:50]
        ],
    }
