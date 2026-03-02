"""
Regulatory submission formatters (Gap F4, P3).

Produce stress test / disclosure output in regulator-specific templates:
- EBA CROE (Common Reporting and Other EBA reporting)
- Fed DFAST / CCAR (US stress testing)
- OSFI E-18 (Canadian stress testing)
- Basel III Pillar 3 (CRE, LIQ, OV disclosure tables)

Input: report_v2-like dict from stress_report_metrics.compute_report_v2, or minimal payload
with total_loss, scenario_name, currency, report_metadata, etc.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def _ensure_report_metadata(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Extract or build report_metadata from payload."""
    meta = payload.get("report_metadata") or {}
    return {
        "scenario_name": meta.get("scenario_name") or payload.get("scenario_name") or "Stress Scenario",
        "report_date": meta.get("report_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "institution_id": meta.get("institution_id") or "INST_001",
        "currency": meta.get("currency") or payload.get("currency") or "EUR",
        "reporting_period": meta.get("reporting_period") or datetime.now(timezone.utc).strftime("%Y-%m"),
    }


def _total_loss_from_payload(payload: Dict[str, Any]) -> float:
    """Get total loss (EUR M) from report_v2 or direct key."""
    if "probabilistic_metrics" in payload and isinstance(payload["probabilistic_metrics"], dict):
        pm = payload["probabilistic_metrics"]
        if "total_loss_eur_m" in pm:
            return float(pm["total_loss_eur_m"])
        if "expected_loss_eur_m" in pm:
            return float(pm["expected_loss_eur_m"])
    return float(payload.get("total_loss", 0) or payload.get("total_loss_eur_m", 0))


# ---------------------------------------------------------------------------
# EBA CROE (Common Reporting - stress test / climate)
# ---------------------------------------------------------------------------
def format_eba_croe(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format stress / climate output for EBA CROE reporting.
    Returns structure aligned with EBA stress test and ESG reporting templates.
    """
    meta = _ensure_report_metadata(payload)
    loss_m = _total_loss_from_payload(payload)
    currency = meta["currency"]

    return {
        "template": "EBA_CROE",
        "description": "EBA Common Reporting and Other reporting - stress test / climate",
        "reporting_entity": meta.get("institution_id"),
        "reporting_period": meta["reporting_period"],
        "report_date": meta["report_date"],
        "sections": {
            "CROE_STRESS": {
                "scenario_identifier": meta["scenario_name"],
                "stress_date": meta["report_date"],
                "total_impact_eur_m": round(loss_m, 2),
                "currency": currency,
                "impact_breakdown": _impact_breakdown(payload, loss_m),
            },
            "CROE_CLIMATE": _climate_section(payload, loss_m),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def _impact_breakdown(payload: Dict[str, Any], loss_m: float) -> List[Dict[str, Any]]:
    """Build impact breakdown from report_v2 sections if present."""
    out = []
    if "sector_metrics" in payload and isinstance(payload["sector_metrics"], dict):
        for k, v in (payload["sector_metrics"] or {}).items():
            if isinstance(v, dict) and "loss" in str(v).lower():
                out.append({"sector": k, "impact_eur_m": v.get("loss_eur_m", loss_m * 0.25)})
    if "insurance_analysis" in payload and isinstance(payload["insurance_analysis"], dict):
        ia = payload["insurance_analysis"]
        out.append({"sector": "insured", "impact_eur_m": ia.get("total_insured_m", loss_m * 0.7)})
        out.append({"sector": "uninsured", "impact_eur_m": ia.get("total_uninsured_m", loss_m * 0.3)})
    if not out:
        out = [{"sector": "total", "impact_eur_m": loss_m}]
    return out


def _climate_section(payload: Dict[str, Any], loss_m: float) -> Dict[str, Any]:
    """Climate-related section for EBA."""
    clim = payload.get("climate_scenarios") or []
    if isinstance(clim, list) and clim:
        scenarios = [{"scenario": s.get("scenario"), "projected_loss_m": s.get("projected_loss_m")} for s in clim[:5]]
    else:
        scenarios = [{"scenario": "Baseline", "projected_loss_m": loss_m}]
    return {
        "scenario_analysis": scenarios,
        "reference": "EBA Guidelines on management of ESG risks",
    }


# ---------------------------------------------------------------------------
# Fed DFAST / CCAR (US)
# ---------------------------------------------------------------------------
def format_fed_dfast_ccar(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format for US Federal Reserve DFAST / CCAR stress test reporting.
    """
    meta = _ensure_report_metadata(payload)
    loss_m = _total_loss_from_payload(payload)

    return {
        "template": "FED_DFAST_CCAR",
        "description": "Federal Reserve DFAST / CCAR stress test reporting",
        "institution_id": meta["institution_id"],
        "reporting_period": meta["reporting_period"],
        "as_of_date": meta["report_date"],
        "scenario": meta["scenario_name"],
        "pre_tax_pre_provision_loss_impact_usd_m": round(loss_m * 1.08, 2),  # EUR->USD indicative
        "capital_impact": {
            "cet1_ratio_bps_change": None,
            "tier1_ratio_bps_change": None,
            "comment": "Capital impact to be populated from capital calculator when available",
        },
        "disclaimer": "For internal risk management purposes. Not an official CCAR submission.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# OSFI E-18 (Canada)
# ---------------------------------------------------------------------------
def format_osfi_e18(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format for OSFI E-18 Guideline (stress testing).
    """
    meta = _ensure_report_metadata(payload)
    loss_m = _total_loss_from_payload(payload)
    currency = meta["currency"]

    return {
        "template": "OSFI_E18",
        "description": "OSFI E-18 Guideline - Stress testing",
        "institution_id": meta["institution_id"],
        "reporting_period": meta["reporting_period"],
        "report_date": meta["report_date"],
        "scenario": meta["scenario_name"],
        "stress_loss_local_m": round(loss_m, 2),
        "currency": currency,
        "sections": {
            "credit_risk_stress": {"loss_m": loss_m, "currency": currency},
            "market_risk_stress": {"loss_m": 0, "currency": currency},
            "operational_risk_stress": {"loss_m": 0, "currency": currency},
        },
        "disclaimer": "For internal risk management purposes. Not for regulatory submission without review.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Basel III Pillar 3 (CRE, LIQ, OV tables)
# ---------------------------------------------------------------------------
def format_basel_pillar3(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format Pillar 3 disclosure template (CRE - Credit Risk Exposure, LIQ - Liquidity, OV - Overview).
    Uses basel_calculator when available to populate OV1 and LIQ1.
    """
    meta = _ensure_report_metadata(payload)
    loss_m = _total_loss_from_payload(payload)
    total_exp = payload.get("total_exposure_m") or (max(loss_m, 1) * 10)
    try:
        from src.services.basel_calculator import calculate_basel_metrics
        m = calculate_basel_metrics(total_exposure_m=total_exp)
        ov_rwa = m.total_rwa_m
        ov_cet1 = m.cet1_ratio_pct
        liq_lcr = m.lcr_pct
        liq_nsfr = m.nsfr_pct
    except Exception:
        ov_rwa = None
        ov_cet1 = None
        liq_lcr = None
        liq_nsfr = None
    return {
        "template": "BASEL_PILLAR3",
        "description": "Basel III Pillar 3 disclosure (CRE, LIQ, OV)",
        "institution_id": meta["institution_id"],
        "reporting_period": meta["reporting_period"],
        "report_date": meta["report_date"],
        "tables": {
            "OV": {
                "table_id": "OV1",
                "name": "Overview of RWA",
                "total_rwa_m": ov_rwa,
                "cet1_ratio_pct": ov_cet1,
                "note": "Populated from Basel calculator" if ov_rwa is not None else None,
            },
            "CRE": {
                "table_id": "CRE1",
                "name": "Credit risk exposure by exposure class",
                "exposure_classes": [],
                "total_exposure_m": total_exp,
                "stress_loss_m": round(loss_m, 2),
            },
            "LIQ": {
                "table_id": "LIQ1",
                "name": "Liquidity coverage ratio",
                "lcr_pct": liq_lcr,
                "nsfr_pct": liq_nsfr,
                "note": "Populated from Basel calculator" if liq_lcr is not None else None,
            },
        },
        "disclaimer": "Template structure only. Not for regulatory submission without full Pillar 3 disclosure.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------
REGULATORY_FORMATS: Dict[str, Any] = {
    "eba_croe": format_eba_croe,
    "fed_dfast": format_fed_dfast_ccar,
    "fed_ccar": format_fed_dfast_ccar,
    "osfi_e18": format_osfi_e18,
    "basel_pillar3": format_basel_pillar3,
}


def format_ecb_srep(payload: Dict[str, Any]) -> Dict[str, Any]:
    """ECB SREP-aligned stress test report."""
    meta = _ensure_report_metadata(payload)
    total_loss = float(payload.get("total_loss") or 0)
    sections = payload.get("sections") or {}
    return {
        "format": "ECB_SREP",
        "version": "2024",
        "report_metadata": meta,
        "srep_elements": {
            "pillar_1_capital": {
                "cet1_ratio_baseline_pct": 14.5,
                "cet1_ratio_stressed_pct": max(4.5, 14.5 - total_loss / 100),
                "minimum_requirement_pct": 4.5,
            },
            "pillar_2_requirements": {
                "p2r_pct": 2.0,
                "p2g_pct": 1.5,
                "total_srep_requirement_pct": 8.0,
            },
            "risk_assessment": {
                "business_model_risk": "medium",
                "governance_risk": "low",
                "credit_risk": "medium" if total_loss < 5 else "high",
                "market_risk": "medium",
                "operational_risk": "low",
                "liquidity_risk": "medium",
            },
            "overall_srep_score": 2 if total_loss < 3 else 3 if total_loss < 8 else 4,
            "capital_decision": "No additional requirements" if total_loss < 5 else "Additional P2G buffer recommended",
        },
        "stress_test_summary": sections.get("executive_summary", ""),
        "recommendations": sections.get("recommendations", []),
        "icaap_integration_points": [
            "Capital planning horizon alignment",
            "Risk appetite framework consistency",
            "Recovery plan trigger calibration",
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def format_fed_fr_y14a(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Fed FR Y-14A data format for CCAR/DFAST submissions."""
    meta = _ensure_report_metadata(payload)
    total_loss = float(payload.get("total_loss") or 0)
    return {
        "format": "FR_Y-14A",
        "version": "2024Q4",
        "report_metadata": meta,
        "schedules": {
            "A_summary": {
                "total_assets_usd": 500e9,
                "tier1_capital_usd": 50e9,
                "risk_weighted_assets_usd": 350e9,
                "pre_provision_net_revenue_usd": 15e9,
                "provision_for_loan_losses_usd": total_loss * 1e9,
                "net_income_usd": (15 - total_loss) * 1e9,
            },
            "B_securities": {
                "afs_portfolio_usd": 80e9,
                "htm_portfolio_usd": 120e9,
                "unrealized_gains_losses_usd": -2e9,
            },
            "H_wholesale": {
                "wholesale_exposures_usd": 150e9,
                "expected_losses_usd": total_loss * 0.4 * 1e9,
            },
        },
        "capital_ratios": {
            "cet1_baseline_pct": 12.5,
            "cet1_stressed_pct": max(4.5, 12.5 - total_loss / 50),
            "tier1_baseline_pct": 14.0,
            "tier1_stressed_pct": max(6.0, 14.0 - total_loss / 50),
            "total_capital_baseline_pct": 16.0,
            "total_capital_stressed_pct": max(8.0, 16.0 - total_loss / 50),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


REGULATORY_FORMATS["ecb_srep"] = format_ecb_srep
REGULATORY_FORMATS["fed_fr_y14a"] = format_fed_fr_y14a


def format_for_regulator(format_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Return stress/disclosure data in the requested regulatory format.
    format_id: eba_croe | fed_dfast | fed_ccar | osfi_e18 | basel_pillar3 | ecb_srep | fed_fr_y14a
    payload: report_v2 or minimal dict with total_loss, report_metadata, etc.
    """
    fn = REGULATORY_FORMATS.get(format_id.lower() if isinstance(format_id, str) else None)
    if not fn:
        return {
            "error": f"Unknown format: {format_id}",
            "available": list(REGULATORY_FORMATS.keys()),
        }
    return fn(payload)
