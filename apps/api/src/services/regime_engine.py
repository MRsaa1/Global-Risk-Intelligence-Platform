"""
Market Regime Engine
====================

Defines 4 market regimes with distinct parameter sets for stress testing:
- Bull Expansion: low vol, low correlation, favorable conditions
- Late Cycle: moderate vol, rising correlation, tightening
- Crisis: high vol, correlation collapse, severe stress
- Stagflation: elevated vol, moderate correlation, persistent inflation

Each regime provides multipliers that modify Monte Carlo parameters,
correlation structures, PD/LGD, and Digital Twin cost factors.

Includes:
- Markov transition matrix for regime switching
- Rule-based detection from market indicators (VIX, inflation, GDP, credit spreads)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Regime definitions
# ---------------------------------------------------------------------------

class MarketRegime(str, Enum):
    BULL = "bull"
    LATE_CYCLE = "late_cycle"
    CRISIS = "crisis"
    STAGFLATION = "stagflation"


@dataclass(frozen=True)
class RegimeParameters:
    """Parameter set for a single market regime."""
    name: str
    label: str
    description: str

    # Monte Carlo multipliers
    volatility_multiplier: float
    correlation_shift: float          # multiplier applied to off-diagonal correlation
    pd_stress_factor: float           # multiplier for Probability of Default
    lgd_stress_factor: float          # multiplier for Loss Given Default

    # Recovery & macro
    recovery_speed_factor: float      # <1 = slower recovery

    # Digital Twin cost factors (Priority 4 uses these)
    energy_cost_multiplier: float
    transport_delay_factor: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "label": self.label,
            "description": self.description,
            "volatility_multiplier": self.volatility_multiplier,
            "correlation_shift": self.correlation_shift,
            "pd_stress_factor": self.pd_stress_factor,
            "lgd_stress_factor": self.lgd_stress_factor,
            "recovery_speed_factor": self.recovery_speed_factor,
            "energy_cost_multiplier": self.energy_cost_multiplier,
            "transport_delay_factor": self.transport_delay_factor,
        }


REGIME_PARAMS: Dict[MarketRegime, RegimeParameters] = {
    MarketRegime.BULL: RegimeParameters(
        name="bull",
        label="Bull Expansion",
        description="Low volatility, low correlation, favorable macro conditions.",
        volatility_multiplier=0.7,
        correlation_shift=0.8,
        pd_stress_factor=0.8,
        lgd_stress_factor=0.9,
        recovery_speed_factor=1.3,
        energy_cost_multiplier=0.9,
        transport_delay_factor=0.9,
    ),
    MarketRegime.LATE_CYCLE: RegimeParameters(
        name="late_cycle",
        label="Late Cycle",
        description="Moderate volatility, rising correlation, tightening financial conditions.",
        volatility_multiplier=1.2,
        correlation_shift=1.1,
        pd_stress_factor=1.3,
        lgd_stress_factor=1.1,
        recovery_speed_factor=0.9,
        energy_cost_multiplier=1.1,
        transport_delay_factor=1.1,
    ),
    MarketRegime.CRISIS: RegimeParameters(
        name="crisis",
        label="Crisis",
        description="High volatility, correlation spike, severe credit stress.",
        volatility_multiplier=2.0,
        correlation_shift=1.8,
        pd_stress_factor=2.5,
        lgd_stress_factor=1.5,
        recovery_speed_factor=0.5,
        energy_cost_multiplier=1.8,
        transport_delay_factor=1.5,
    ),
    MarketRegime.STAGFLATION: RegimeParameters(
        name="stagflation",
        label="Stagflation",
        description="Elevated volatility, moderate correlation, persistent inflation with low growth.",
        volatility_multiplier=1.5,
        correlation_shift=1.4,
        pd_stress_factor=1.8,
        lgd_stress_factor=1.3,
        recovery_speed_factor=0.7,
        energy_cost_multiplier=1.5,
        transport_delay_factor=1.3,
    ),
}


def get_regime_params(regime: MarketRegime) -> RegimeParameters:
    """Return parameter set for the given regime."""
    return REGIME_PARAMS[regime]


def get_all_regimes() -> List[Dict[str, Any]]:
    """Return all regimes with their parameter sets (for API listing)."""
    return [
        {"regime": r.value, **REGIME_PARAMS[r].to_dict()}
        for r in MarketRegime
    ]


# ---------------------------------------------------------------------------
# Markov transition matrix (4×4)
# ---------------------------------------------------------------------------
# Rows = current regime, columns = next regime
# Order: Bull, Late Cycle, Crisis, Stagflation

TRANSITION_MATRIX = np.array([
    # To:  Bull   Late   Crisis  Stagfl
    [0.70, 0.20, 0.05, 0.05],   # From Bull
    [0.15, 0.55, 0.20, 0.10],   # From Late Cycle
    [0.10, 0.15, 0.60, 0.15],   # From Crisis
    [0.10, 0.20, 0.15, 0.55],   # From Stagflation
], dtype=np.float64)

_REGIME_ORDER = [MarketRegime.BULL, MarketRegime.LATE_CYCLE, MarketRegime.CRISIS, MarketRegime.STAGFLATION]


def get_transition_matrix() -> Dict[str, Any]:
    """Return the transition matrix in a serialisable form."""
    return {
        "regimes": [r.value for r in _REGIME_ORDER],
        "matrix": TRANSITION_MATRIX.tolist(),
    }


def next_regime_probability(current: MarketRegime) -> Dict[str, float]:
    """Given current regime, return probabilities for each next regime."""
    idx = _REGIME_ORDER.index(current)
    row = TRANSITION_MATRIX[idx]
    return {r.value: float(row[i]) for i, r in enumerate(_REGIME_ORDER)}


def sample_next_regime(current: MarketRegime) -> MarketRegime:
    """Sample the next regime from the Markov chain."""
    idx = _REGIME_ORDER.index(current)
    probs = TRANSITION_MATRIX[idx]
    next_idx = int(np.random.choice(len(_REGIME_ORDER), p=probs))
    return _REGIME_ORDER[next_idx]


# ---------------------------------------------------------------------------
# Rule-based regime detection from market indicators
# ---------------------------------------------------------------------------

@dataclass
class MarketIndicators:
    """Observable market indicators for regime detection."""
    vix: Optional[float] = None               # VIX index level
    inflation: Optional[float] = None         # annual inflation %
    gdp_growth: Optional[float] = None        # annual GDP growth %
    credit_spread: Optional[float] = None     # credit spread in basis points
    rate_rising: Optional[bool] = None        # True if rates are on an upward trend

    @classmethod
    def from_dict(cls, d: Optional[Dict[str, Any]]) -> "MarketIndicators":
        if not d:
            return cls()
        return cls(
            vix=d.get("vix"),
            inflation=d.get("inflation"),
            gdp_growth=d.get("gdp_growth"),
            credit_spread=d.get("credit_spread"),
            rate_rising=d.get("rate_rising"),
        )


def detect_regime(indicators: MarketIndicators) -> MarketRegime:
    """
    Rule-based regime detection (Phase 1).

    Priority order (first match wins):
    1. Crisis:      VIX > 35  OR  credit_spread > 500 bps
    2. Stagflation: inflation > 5%  AND  gdp_growth < 1%
    3. Late Cycle:  inflation > 3%  AND  rate_rising
    4. Bull:        default
    """
    # Crisis
    if (indicators.vix is not None and indicators.vix > 35) or \
       (indicators.credit_spread is not None and indicators.credit_spread > 500):
        logger.info("Regime detected: CRISIS (VIX=%.1f, spread=%.0f)",
                     indicators.vix or 0, indicators.credit_spread or 0)
        return MarketRegime.CRISIS

    # Stagflation
    if (indicators.inflation is not None and indicators.inflation > 5) and \
       (indicators.gdp_growth is not None and indicators.gdp_growth < 1):
        logger.info("Regime detected: STAGFLATION (inflation=%.1f%%, GDP=%.1f%%)",
                     indicators.inflation, indicators.gdp_growth)
        return MarketRegime.STAGFLATION

    # Late Cycle
    if (indicators.inflation is not None and indicators.inflation > 3) and \
       (indicators.rate_rising is True):
        logger.info("Regime detected: LATE_CYCLE (inflation=%.1f%%, rates rising)",
                     indicators.inflation)
        return MarketRegime.LATE_CYCLE

    # Default
    logger.info("Regime detected: BULL (default)")
    return MarketRegime.BULL


def resolve_regime(
    explicit: Optional[str],
    indicators_dict: Optional[Dict[str, Any]] = None,
) -> MarketRegime:
    """
    Resolve the regime to use for a stress test.

    - If explicit is a valid regime name -> use it directly
    - If explicit == "auto" or None -> detect from indicators (or default to BULL)
    """
    if explicit and explicit != "auto":
        try:
            return MarketRegime(explicit)
        except ValueError:
            logger.warning("Unknown regime '%s', falling back to auto-detect", explicit)

    indicators = MarketIndicators.from_dict(indicators_dict)
    return detect_regime(indicators)


# ---------------------------------------------------------------------------
# Helpers for applying regime to stress-test parameters
# ---------------------------------------------------------------------------

def apply_regime_to_stress_factor(base_factor: float, regime: MarketRegime) -> float:
    """Multiply the base stress factor by the regime's volatility multiplier."""
    rp = REGIME_PARAMS[regime]
    return base_factor * rp.volatility_multiplier


def apply_regime_to_correlation(corr_matrix: np.ndarray, regime: MarketRegime) -> np.ndarray:
    """
    Shift off-diagonal correlations by the regime's correlation_shift.
    Keeps diagonal = 1 and clamps values to [-1, 1].
    """
    rp = REGIME_PARAMS[regime]
    shifted = corr_matrix.copy()
    n = shifted.shape[0]
    for i in range(n):
        for j in range(n):
            if i != j:
                shifted[i, j] = np.clip(shifted[i, j] * rp.correlation_shift, -1.0, 1.0)
    # Ensure positive-semi-definiteness via nearest PD if needed
    try:
        np.linalg.cholesky(shifted)
    except np.linalg.LinAlgError:
        eigenvalues, eigenvectors = np.linalg.eigh(shifted)
        eigenvalues = np.maximum(eigenvalues, 1e-8)
        shifted = eigenvectors @ np.diag(eigenvalues) @ eigenvectors.T
        np.fill_diagonal(shifted, 1.0)
    return shifted


def apply_regime_to_pd_lgd(
    pd_array: np.ndarray,
    lgd_array: np.ndarray,
    regime: MarketRegime,
) -> tuple[np.ndarray, np.ndarray]:
    """Apply regime PD/LGD stress factors. Caps PD at 0.99, LGD at 0.95."""
    rp = REGIME_PARAMS[regime]
    stressed_pd = np.minimum(pd_array * rp.pd_stress_factor, 0.99)
    stressed_lgd = np.minimum(lgd_array * rp.lgd_stress_factor, 0.95)
    return stressed_pd, stressed_lgd
