"""
Integral risk model: RiskIndex% as weighted sum over all risks.

Formula per risk i (with data quality Q_i):
  Score_i = Sev_i × Prob_i × Impact_i × W_country,i × W_city,i × W_influence,i × (1 − Control_i) × Q_i

Q_i ∈ [0.6, 1.0]: data quality from confidence / source freshness / coverage (1.0 = full confidence).

Integral index:
  RiskIndex% = 100 × Σ Score_i / Σ MaxScore_i

MaxScore_i = 4 × 5 × 5 × W_country × W_city × W_influence × 1 (worst case: Control=0, Q=1 in denominator).

Design: Normalization by MaxScore_i makes geo/influence weights act as relative importance between risks,
not as absolute risk amplifiers. Document this when presenting the model.

Missing inputs: Do not substitute "average risk" (e.g. 0.5). Use unknown + quality penalty (see
MISSING_INPUT_QUALITY_PENALTY) or exclude the risk from the sum; expose a quality/unknown flag to the caller.

Zones: 0–25% Low, 25–50% Medium, 50–75% High, 75–100% Critical (to be calibrated on historical backtesting).
"""
from dataclasses import dataclass
from typing import List, Optional, Tuple

# --- Severity (1–4) ---
SEV_LOW = 1
SEV_MEDIUM = 2
SEV_HIGH = 3
SEV_CRITICAL = 4
SEV_MAX = 4

# --- Probability (1–5) ---
PROB_RARE = 1
PROB_UNLIKELY = 2
PROB_POSSIBLE = 3
PROB_LIKELY = 4
PROB_ALMOST_CERTAIN = 5
PROB_MAX = 5

# --- Impact (1–5) ---
IMPACT_MINOR = 1
IMPACT_MODERATE = 2
IMPACT_SIGNIFICANT = 3
IMPACT_MAJOR = 4
IMPACT_SEVERE = 5
IMPACT_MAX = 5

# --- W_country (country risk tier) ---
W_COUNTRY_LOW = 0.90
W_COUNTRY_MEDIUM = 1.00
W_COUNTRY_ELEVATED = 1.15
W_COUNTRY_HIGH = 1.30
W_COUNTRY_EXTREME = 1.50

# --- W_city (city tension) ---
W_CITY_CALM = 0.95
W_CITY_NEUTRAL = 1.00
W_CITY_TENSE = 1.10
W_CITY_CRITICAL = 1.25

# --- W_influence (business/asset importance) ---
W_INFLUENCE_LOW = 0.80
W_INFLUENCE_MEDIUM = 1.00
W_INFLUENCE_HIGH = 1.25
W_INFLUENCE_CRITICAL = 1.50

# --- Zone thresholds (RiskIndex%): 0–25 Low, 25–50 Medium, 50–75 High, 75–100 Critical ---
ZONE_LOW_MAX_PCT = 25.0
ZONE_MEDIUM_MAX_PCT = 50.0
ZONE_HIGH_MAX_PCT = 75.0
# 75–100 = Critical

# --- Data quality Q_i: 0.6–1.0 (confidence / freshness / coverage) ---
Q_MIN = 0.6
Q_MAX = 1.0
# When Prob/Impact/Control (or other core inputs) are missing, apply penalty to Q instead of substituting a value
MISSING_INPUT_QUALITY_PENALTY = 0.8  # e.g. Q_effective = Q * 0.8 when any core input is unknown


@dataclass
class IntegralRiskInput:
    """Single risk input for integral risk calculation."""
    sev: int  # 1–4
    prob: int  # 1–5
    impact: int  # 1–5
    w_country: float = 1.0
    w_city: float = 1.0
    w_influence: float = 1.0
    control: float = 0.0  # 0..1, 0 = no controls
    quality: float = 1.0  # Q_i in [0.6, 1.0]; from confidence/source freshness/coverage
    label: Optional[str] = None  # e.g. "climate", "seismic"
    # Set to True if any of sev/prob/impact/control were inferred or missing (caller may apply quality penalty)
    inputs_incomplete: bool = False


def score_i(r: IntegralRiskInput) -> float:
    """Score for one risk: Sev × Prob × Impact × W_country × W_city × W_influence × (1 − Control) × Q."""
    q = max(Q_MIN, min(Q_MAX, r.quality))
    if r.inputs_incomplete:
        q = q * MISSING_INPUT_QUALITY_PENALTY
    return (
        r.sev * r.prob * r.impact
        * r.w_country * r.w_city * r.w_influence
        * (1.0 - max(0.0, min(1.0, r.control)))
        * q
    )


def max_score_i(r: IntegralRiskInput) -> float:
    """Max possible score for this risk (worst case, no control). Q included in denominator via Score."""
    return (
        SEV_MAX * PROB_MAX * IMPACT_MAX
        * r.w_country * r.w_city * r.w_influence
        * Q_MAX
    )


def risk_index(risks: List[IntegralRiskInput]) -> Tuple[float, str]:
    """
    Compute integral RiskIndex% and zone from list of risks.

    Returns:
        (risk_index_pct, zone) where zone is "low" | "medium" | "high" | "critical".
    """
    if not risks:
        return 0.0, "low"

    total_score = sum(score_i(r) for r in risks)
    total_max = sum(max_score_i(r) for r in risks)
    if total_max <= 0:
        return 0.0, "low"

    pct = 100.0 * total_score / total_max
    zone = _zone_from_pct(pct)
    return round(pct, 2), zone


def _zone_from_pct(pct: float) -> str:
    """Map RiskIndex% to zone: 0–25 Low, 25–50 Medium, 50–75 High, 75–100 Critical."""
    if pct < ZONE_LOW_MAX_PCT:
        return "low"
    if pct < ZONE_MEDIUM_MAX_PCT:
        return "medium"
    if pct < ZONE_HIGH_MAX_PCT:
        return "high"
    return "critical"


def risk_index_with_breakdown(risks: List[IntegralRiskInput]) -> dict:
    """
    Same as risk_index but return full breakdown: scores, max_scores, index %, zone.
    """
    if not risks:
        return {
            "risk_index_pct": 0.0,
            "zone": "low",
            "total_score": 0.0,
            "total_max_score": 0.0,
            "per_risk": [],
        }

    per_risk = [
        {
            "label": r.label,
            "score": score_i(r),
            "max_score": max_score_i(r),
            "quality": round(max(Q_MIN, min(Q_MAX, r.quality)), 2),
            "inputs_incomplete": r.inputs_incomplete,
        }
        for r in risks
    ]
    total_score = sum(s["score"] for s in per_risk)
    total_max = sum(s["max_score"] for s in per_risk)
    pct = 100.0 * total_score / total_max if total_max > 0 else 0.0
    zone = _zone_from_pct(pct)

    return {
        "risk_index_pct": round(pct, 2),
        "zone": zone,
        "total_score": round(total_score, 4),
        "total_max_score": round(total_max, 4),
        "per_risk": per_risk,
    }
