"""
Basel III/IV capital and liquidity metrics (CRR/CRR2).

Provides RWA (risk-weighted assets), CET1 ratio, LCR, NSFR for regulatory
disclosure and Pillar 3 export. Used by compliance dashboard and regulatory_formatters.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class BaselMetrics:
    """Basel III/IV capital and liquidity metrics."""
    total_rwa_m: float
    cet1_capital_m: float
    tier1_capital_m: float
    total_capital_m: float
    cet1_ratio_pct: float
    tier1_ratio_pct: float
    total_capital_ratio_pct: float
    leverage_ratio_pct: float
    lcr_pct: float
    nsfr_pct: float


def calculate_rwa(
    exposure_credit_m: float = 0,
    exposure_market_m: float = 0,
    exposure_operational_m: float = 0,
    risk_weight_credit_pct: float = 100,
    risk_weight_market_pct: float = 100,
    risk_weight_operational_pct: float = 15,
) -> float:
    """
    Risk-weighted assets (simplified standardised approach).
    RWA = sum(exposure * risk_weight) per asset class.
    """
    return (
        exposure_credit_m * (risk_weight_credit_pct / 100)
        + exposure_market_m * (risk_weight_market_pct / 100)
        + exposure_operational_m * (risk_weight_operational_pct / 100)
    )


def calculate_basel_metrics(
    total_rwa_m: float | None = None,
    cet1_capital_m: float = 100,
    tier1_capital_m: float | None = None,
    total_capital_m: float | None = None,
    total_exposure_m: float | None = None,
    hqla_m: float = 80,
    net_cash_outflows_30d_m: float = 70,
    available_stable_funding_m: float = 90,
    required_stable_funding_m: float = 85,
    exposure_credit_m: float = 0,
    exposure_market_m: float = 0,
    exposure_operational_m: float = 0,
    risk_weight_credit_pct: float = 100,
    risk_weight_market_pct: float = 100,
    risk_weight_operational_pct: float = 15,
) -> BaselMetrics:
    """
    Compute Basel III/IV metrics. If total_rwa_m not provided, derives from exposures.
    CET1 >= 4.5%, Tier1 >= 6%, Total >= 8%. LCR >= 100%, NSFR >= 100%.
    """
    if total_rwa_m is None:
        total_rwa_m = calculate_rwa(
            exposure_credit_m=exposure_credit_m or max(1, total_exposure_m or 1) * 0.7,
            exposure_market_m=exposure_market_m or (total_exposure_m or 0) * 0.2,
            exposure_operational_m=exposure_operational_m or (total_exposure_m or 0) * 0.1,
            risk_weight_credit_pct=risk_weight_credit_pct,
            risk_weight_market_pct=risk_weight_market_pct,
            risk_weight_operational_pct=risk_weight_operational_pct,
        )
    rwa = max(total_rwa_m, 0.01)
    tier1 = tier1_capital_m if tier1_capital_m is not None else cet1_capital_m * 1.0
    total = total_capital_m if total_capital_m is not None else tier1 * (8 / 6)
    cet1_ratio = (cet1_capital_m / rwa) * 100 if rwa else 0
    tier1_ratio = (tier1 / rwa) * 100 if rwa else 0
    total_ratio = (total / rwa) * 100 if rwa else 0
    total_exp = total_exposure_m or (rwa * 1.1)
    leverage = (tier1 / total_exp) * 100 if total_exp else 0
    lcr = (hqla_m / net_cash_outflows_30d_m) * 100 if net_cash_outflows_30d_m else 0
    nsfr = (available_stable_funding_m / required_stable_funding_m) * 100 if required_stable_funding_m else 0
    return BaselMetrics(
        total_rwa_m=rwa,
        cet1_capital_m=cet1_capital_m,
        tier1_capital_m=tier1,
        total_capital_m=total,
        cet1_ratio_pct=round(cet1_ratio, 2),
        tier1_ratio_pct=round(tier1_ratio, 2),
        total_capital_ratio_pct=round(total_ratio, 2),
        leverage_ratio_pct=round(leverage, 2),
        lcr_pct=round(lcr, 2),
        nsfr_pct=round(nsfr, 2),
    )


def basel_metrics_to_dict(m: BaselMetrics) -> Dict[str, Any]:
    """Serialize for API and Pillar 3 export."""
    return {
        "total_rwa_m": m.total_rwa_m,
        "cet1_capital_m": m.cet1_capital_m,
        "tier1_capital_m": m.tier1_capital_m,
        "total_capital_m": m.total_capital_m,
        "cet1_ratio_pct": m.cet1_ratio_pct,
        "tier1_ratio_pct": m.tier1_ratio_pct,
        "total_capital_ratio_pct": m.total_capital_ratio_pct,
        "leverage_ratio_pct": m.leverage_ratio_pct,
        "lcr_pct": m.lcr_pct,
        "nsfr_pct": m.nsfr_pct,
    }
