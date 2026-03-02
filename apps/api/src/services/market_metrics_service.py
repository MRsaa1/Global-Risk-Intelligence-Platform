"""
Volatility and liquidity metrics for stress scenarios.

Computes realized/historical volatility and a simple liquidity indicator
from price/volume series (or returns demo values when no data source is configured).
Used by volatility_spike and liquidity_dry_up stress scenarios.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def compute_volatility(returns: List[float]) -> float:
    """Realized volatility (annualized) from a list of period returns. Empty -> 0."""
    if not returns:
        return 0.0
    n = len(returns)
    mean = sum(returns) / n
    variance = sum((r - mean) ** 2 for r in returns) / max(n - 1, 1)
    # Annualize assuming 252 trading days
    import math
    return math.sqrt(variance * 252) if variance >= 0 else 0.0


def compute_liquidity_score(
    volumes: Optional[List[float]] = None,
    spread_bps: Optional[float] = None,
) -> float:
    """
    Simple liquidity score 0-1: higher volume and lower spread = higher score.
    If no data, returns 0.5 (neutral).
    """
    score = 0.5
    if volumes:
        # Normalize by max volume (or use median)
        v_max = max(volumes) if volumes else 1
        score = min(1.0, (sum(volumes) / len(volumes)) / max(v_max, 1) * 1.2)
    if spread_bps is not None:
        # Lower spread = better; assume 10 bps = 1.0, 100 bps = 0.3
        spread_score = max(0.0, 1.0 - (spread_bps / 100.0) * 0.7)
        score = (score + spread_score) / 2
    return round(min(1.0, max(0.0, score)), 4)


def get_current_volatility_and_liquidity(
    instrument_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Return current volatility and liquidity metrics (from configured source or demo).
    instrument_ids: optional list to filter; when empty uses default set.
    """
    # Placeholder: in production would fetch from exchange/aggregator
    # For now return demo values so stress scenarios can reference them
    return {
        "volatility_annual": 0.18,
        "volatility_90d": 0.15,
        "liquidity_score": 0.72,
        "spread_bps": 12.0,
        "source": "demo",
        "instrument_ids": instrument_ids or [],
    }
