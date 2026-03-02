"""
Solvency II capital metrics: SCR, MCR, Solvency Ratio (Standard Formula).

Used for regulatory reporting (QRT, SFCR) and compliance dashboard.
References: Solvency II Dir. Art. 100–127 (SCR), Art. 128–131 (MCR).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class SolvencyMetrics:
    """Solvency II SCR, MCR and ratio metrics."""
    scr_m: float
    mcr_m: float
    own_funds_m: float
    solvency_ratio_pct: float
    mcr_ratio_pct: float
    eligible_own_funds_m: float


def calculate_scr_standard_formula(
    market_risk_m: float = 20,
    counterparty_risk_m: float = 5,
    life_underwriting_m: float = 10,
    health_underwriting_m: float = 5,
    non_life_underwriting_m: float = 15,
    intangible_risk_m: float = 0,
    operational_risk_m: float = 8,
) -> float:
    """
    SCR via Standard Formula (simplified): SCR = sqrt(sum Corr * module^2) + modules.
    Simplified as sum of modules with correlation omitted for transparency.
    """
    return (
        market_risk_m + counterparty_risk_m + life_underwriting_m
        + health_underwriting_m + non_life_underwriting_m
        + intangible_risk_m + operational_risk_m
    )


def calculate_mcr(
    technical_provisions_m: float = 50,
    premiums_annual_m: float = 30,
    life_floor_eur: float = 3.7,
    non_life_floor_eur: float = 2.5,
    is_life: bool = False,
) -> float:
    """
    Minimum Capital Requirement (Art. 128–131). Linear formula based on TP and premiums;
    floor €3.7M (life) / €2.5M (non-life).
    """
    linear = 0.25 * technical_provisions_m + 0.20 * premiums_annual_m
    floor = life_floor_eur if is_life else non_life_floor_eur
    return max(linear, floor)


def calculate_solvency_metrics(
    own_funds_m: float = 100,
    technical_provisions_m: float = 50,
    premiums_annual_m: float = 30,
    market_risk_m: float = 20,
    counterparty_risk_m: float = 5,
    life_underwriting_m: float = 10,
    health_underwriting_m: float = 5,
    non_life_underwriting_m: float = 15,
    operational_risk_m: float = 8,
    is_life: bool = False,
) -> SolvencyMetrics:
    """Compute SCR, MCR and Solvency Ratio. Own funds and SCR in same currency (e.g. EUR m)."""
    scr = calculate_scr_standard_formula(
        market_risk_m=market_risk_m,
        counterparty_risk_m=counterparty_risk_m,
        life_underwriting_m=life_underwriting_m,
        health_underwriting_m=health_underwriting_m,
        non_life_underwriting_m=non_life_underwriting_m,
        operational_risk_m=operational_risk_m,
    )
    mcr = calculate_mcr(
        technical_provisions_m=technical_provisions_m,
        premiums_annual_m=premiums_annual_m,
        is_life=is_life,
    )
    solvency_ratio = (own_funds_m / scr) * 100 if scr else 0
    mcr_ratio = (own_funds_m / mcr) * 100 if mcr else 0
    return SolvencyMetrics(
        scr_m=round(scr, 2),
        mcr_m=round(mcr, 2),
        own_funds_m=own_funds_m,
        solvency_ratio_pct=round(solvency_ratio, 2),
        mcr_ratio_pct=round(mcr_ratio, 2),
        eligible_own_funds_m=own_funds_m,
    )


def solvency_metrics_to_dict(m: SolvencyMetrics) -> Dict[str, Any]:
    """Serialize for API and QRT/SFCR export."""
    return {
        "scr_m": m.scr_m,
        "mcr_m": m.mcr_m,
        "own_funds_m": m.own_funds_m,
        "solvency_ratio_pct": m.solvency_ratio_pct,
        "mcr_ratio_pct": m.mcr_ratio_pct,
        "eligible_own_funds_m": m.eligible_own_funds_m,
    }
