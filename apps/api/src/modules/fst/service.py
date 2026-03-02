"""FST module service layer.

Financial System Stress Test Engine: EBA/CCAR/PRA/ECB scenario library,
interbank contagion modelling, liquidity stress (LCR/NSFR), derivative
exposure unwinding, and multi-format regulatory report generation.
"""
import json
import logging
import math
import random
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import FSTRun

logger = logging.getLogger(__name__)

# Full scenario library (regulatory-aligned)
FST_SCENARIOS: List[Dict[str, Any]] = [
    # EBA scenarios
    {"id": "eba_2024_adverse", "name": "EBA 2024 Adverse", "description": "EU-wide adverse scenario: GDP -6%, unemployment +5pp, house prices -25%", "physical_shock": None, "regulatory_format": "ecb", "category": "eba", "severity": "adverse", "gdp_shock": -0.06, "unemployment_shock": 0.05, "housing_shock": -0.25, "interest_rate_shock": 0.03},
    {"id": "eba_2024_baseline", "name": "EBA 2024 Baseline", "description": "EU-wide baseline scenario for comparison", "physical_shock": None, "regulatory_format": "ecb", "category": "eba", "severity": "baseline", "gdp_shock": 0.015, "unemployment_shock": 0.0, "housing_shock": 0.02, "interest_rate_shock": 0.0},
    # Fed CCAR
    {"id": "fed_ccar_severely_adverse", "name": "Fed CCAR Severely Adverse", "description": "US severely adverse: GDP -8.75%, unemployment 10%, house prices -28.5%", "physical_shock": None, "regulatory_format": "fed", "category": "ccar", "severity": "severely_adverse", "gdp_shock": -0.0875, "unemployment_shock": 0.10, "housing_shock": -0.285, "interest_rate_shock": -0.02},
    {"id": "fed_ccar_adverse", "name": "Fed CCAR Adverse", "description": "US adverse: recession, moderate unemployment rise", "physical_shock": None, "regulatory_format": "fed", "category": "ccar", "severity": "adverse", "gdp_shock": -0.04, "unemployment_shock": 0.07, "housing_shock": -0.15, "interest_rate_shock": 0.01},
    # PRA ACS
    {"id": "pra_acs_2024", "name": "PRA ACS 2024", "description": "UK Annual Cyclical Scenario: deep recession with global trade disruption", "physical_shock": None, "regulatory_format": "basel", "category": "pra", "severity": "adverse", "gdp_shock": -0.05, "unemployment_shock": 0.06, "housing_shock": -0.20, "interest_rate_shock": 0.04},
    # Climate-physical combined
    {"id": "banking_crisis_physical_shock", "name": "Banking crisis under physical shock", "description": "Combined climate/physical shock and bank capital stress", "physical_shock": "climate", "regulatory_format": "basel", "category": "custom", "severity": "severe", "gdp_shock": -0.07, "unemployment_shock": 0.06, "housing_shock": -0.30, "interest_rate_shock": 0.02},
    {"id": "climate_stress_bank_capital", "name": "Climate stress and bank capital", "description": "Long-term climate scenario impact on bank capital (NGFS Hot House)", "physical_shock": "climate", "regulatory_format": "ecb", "category": "ngfs", "severity": "adverse", "gdp_shock": -0.03, "unemployment_shock": 0.03, "housing_shock": -0.15, "interest_rate_shock": 0.0},
    # Derivatives / liquidity
    {"id": "derivatives_unwinding", "name": "Derivatives unwinding", "description": "Rapid unwinding of derivatives book under margin stress and counterparty default", "physical_shock": None, "regulatory_format": "fed", "category": "custom", "severity": "severe", "gdp_shock": -0.04, "unemployment_shock": 0.03, "housing_shock": -0.10, "interest_rate_shock": 0.05},
    {"id": "liquidity_stress_lcr", "name": "Liquidity stress (LCR)", "description": "30-day liquidity coverage ratio stress: deposit outflows, collateral haircuts", "physical_shock": None, "regulatory_format": "basel", "category": "liquidity", "severity": "adverse", "gdp_shock": -0.02, "unemployment_shock": 0.01, "housing_shock": -0.05, "interest_rate_shock": 0.03},
    {"id": "nsfr_funding_stress", "name": "NSFR funding stress", "description": "Net stable funding ratio stress: wholesale funding freeze", "physical_shock": None, "regulatory_format": "basel", "category": "liquidity", "severity": "adverse", "gdp_shock": -0.03, "unemployment_shock": 0.02, "housing_shock": -0.08, "interest_rate_shock": 0.04},
    # Interbank contagion
    {"id": "interbank_contagion", "name": "Interbank contagion", "description": "Counterparty default cascade through interbank exposures", "physical_shock": None, "regulatory_format": "ecb", "category": "systemic", "severity": "severe", "gdp_shock": -0.06, "unemployment_shock": 0.05, "housing_shock": -0.20, "interest_rate_shock": 0.03},
    # Sovereign-bank nexus
    {"id": "sovereign_bank_nexus", "name": "Sovereign-bank doom loop", "description": "Sovereign debt crisis feeding into bank capital through bond holdings", "physical_shock": None, "regulatory_format": "ecb", "category": "systemic", "severity": "severe", "gdp_shock": -0.08, "unemployment_shock": 0.07, "housing_shock": -0.25, "interest_rate_shock": 0.06},
]


class FSTService:
    """Service for Financial System Stress Test Engine operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.module_namespace = "fst"

    async def list_scenarios(
        self,
        category: Optional[str] = None,
        severity: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Return FST scenario definitions with optional filtering."""
        out = list(FST_SCENARIOS)
        if category:
            out = [s for s in out if s.get("category") == category]
        if severity:
            out = [s for s in out if s.get("severity") == severity]
        return out

    async def run_scenario(
        self,
        scenario_id: str,
        regulatory_format: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Run an FST scenario. Uses SRO contagion / stress infrastructure where available;
        returns regulatory report structure (Basel/Fed/ECB-compatible format).
        """
        params = params or {}
        scenario = next((s for s in FST_SCENARIOS if s["id"] == scenario_id), None)
        if not scenario:
            return {
                "error": "Scenario not found",
                "scenario_id": scenario_id,
                "available": [s["id"] for s in FST_SCENARIOS],
            }

        # Optional: call SRO contagion simulator with physical shock params
        sro_result = None
        try:
            from src.modules.sro.contagion_simulator import get_contagion_simulator, ShockDefinition
            sim = get_contagion_simulator(self.db)
            shock = ShockDefinition(
                shock_type=scenario.get("physical_shock") or "financial_stress",
                magnitude=0.15,
                duration_days=30,
            )
            cascade = await sim.simulate_cascade(
                initial_shock=shock,
                time_horizon_days=90,
                n_monte_carlo=5,
            )
            sro_result = {
                "percentiles": getattr(cascade, "percentiles", {}),
                "probability_systemic_collapse": getattr(cascade, "probability_systemic_collapse", 0),
            }
        except Exception as e:
            logger.warning("FST: SRO contagion not available: %s", e)

        pct = (sro_result or {}).get("percentiles") or {}
        p50 = float(pct.get("p50") or 0)
        p95 = float(pct.get("p95") or 0)
        fmt_label = (regulatory_format or scenario.get("regulatory_format", "basel")).upper()
        exec_summary = (
            f"Stress test run: {scenario.get('name')}. "
            f"Regulatory format: {fmt_label}. "
        )
        if sro_result:
            exec_summary += f"SRO contagion percentiles: p50={p50:.2%}, p95={p95:.2%}. "
        exec_summary += "Report generated from platform stress engine and SRO cascade where available."

        capital_impact = (
            f"Indicative capital impact from stress run: p50 loss {p50:.2%}, p95 loss {p95:.2%}. "
            "Values are model outputs; capital adequacy assessment requires internal review."
        )
        recs = ["Review capital buffers", "Monitor correlation breakdown"]
        if p95 > 0.1:
            recs.append("Consider strengthening capital or hedging tail exposure")
        if (sro_result or {}).get("probability_systemic_collapse", 0) > 0.05:
            recs.append("Assess systemic contagion channels")

        # Build regulatory report structure from real run data
        report = {
            "scenario_id": scenario_id,
            "scenario_name": scenario.get("name"),
            "regulatory_format": regulatory_format or scenario.get("regulatory_format", "basel"),
            "run_at": datetime.utcnow().isoformat(),
            "sections": {
                "executive_summary": exec_summary,
                "scenario_description": scenario.get("description"),
                "physical_shock": scenario.get("physical_shock"),
                "financial_impact": pct if pct else {"p50": 0, "p95": 0},
                "capital_impact": capital_impact,
                "recommendations": recs,
            },
        }

        # Regulatory package: structure aligned to checklist (EBA/ECB, Fed, Basel)
        fmt = (regulatory_format or scenario.get("regulatory_format", "basel")).lower()
        payload = {
            "scenario_name": report["scenario_name"],
            "report_metadata": {
                "scenario_name": report["scenario_name"],
                "report_date": report["run_at"][:10],
                "institution_id": "INST_001",
                "currency": "EUR",
                "reporting_period": report["run_at"][:7],
            },
            "total_loss": 0,
            "sections": report["sections"],
        }
        if sro_result and isinstance(sro_result.get("percentiles"), dict):
            pct = sro_result["percentiles"]
            payload["total_loss"] = float(pct.get("p50") or pct.get("p95") or 0) * 100  # indicative EUR M
        try:
            from src.services.regulatory_formatters import format_eba_croe, format_fed_dfast_ccar, format_basel_pillar3
            if fmt == "ecb":
                regulatory_package = format_eba_croe(payload)
            elif fmt == "fed":
                regulatory_package = format_fed_dfast_ccar(payload)
            else:
                regulatory_package = format_basel_pillar3(payload)
        except Exception as e:
            logger.warning("FST regulatory_package build failed: %s", e)
            regulatory_package = {"error": str(e), "regulatory_format": fmt}

        # Persist run metadata
        fst_id = f"FST-RUN-{str(uuid4())[:8].upper()}"
        run = FSTRun(
            id=str(uuid4()),
            fst_id=fst_id,
            scenario_type=scenario_id,
            scenario_name=scenario.get("name"),
            status="completed",
            regulatory_format=report["regulatory_format"],
            summary_json=json.dumps(report["sections"]),
            run_at=datetime.utcnow(),
        )
        self.db.add(run)
        await self.db.flush()

        return {
            "fst_run_id": fst_id,
            "report": report,
            "report_status": "draft",
            "pilot": True,
            "sro_summary": sro_result if sro_result else None,
            "regulatory_package": regulatory_package,
        }
    async def list_runs(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """List recent FST runs."""
        q = select(FSTRun).order_by(FSTRun.run_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(q)
        rows = result.scalars().all()
        return [
            {
                "id": r.id,
                "fst_id": r.fst_id,
                "scenario_type": r.scenario_type,
                "scenario_name": r.scenario_name,
                "status": r.status,
                "regulatory_format": r.regulatory_format,
                "run_at": r.run_at.isoformat() if r.run_at else None,
            }
            for r in rows
        ]

    async def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get a single FST run by id or fst_id."""
        result = await self.db.execute(
            select(FSTRun).where((FSTRun.id == run_id) | (FSTRun.fst_id == run_id))
        )
        r = result.scalar_one_or_none()
        if not r:
            return None
        summary = {}
        try:
            summary = json.loads(r.summary_json) if r.summary_json else {}
        except Exception:
            pass
        return {
            "id": r.id,
            "fst_id": r.fst_id,
            "scenario_type": r.scenario_type,
            "scenario_name": r.scenario_name,
            "status": r.status,
            "regulatory_format": r.regulatory_format,
            "summary": summary,
            "run_at": r.run_at.isoformat() if r.run_at else None,
        }

    async def run_batch(
        self,
        scenario_ids: List[str],
        regulatory_format: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Run multiple scenarios for cross-comparison."""
        results = []
        for sid in scenario_ids:
            r = await self.run_scenario(sid, regulatory_format=regulatory_format, params=params)
            results.append(r)
        return results

    # ------------------------------------------------------------------
    # Interbank contagion model
    # ------------------------------------------------------------------

    def simulate_interbank_contagion(
        self,
        n_banks: int = 20,
        default_probability: float = 0.05,
        exposure_pct: float = 0.15,
        n_rounds: int = 5,
        n_mc: int = 500,
    ) -> Dict[str, Any]:
        """
        Monte Carlo interbank contagion: default cascades through exposure network.
        Returns distribution of total defaults and systemic loss.
        """
        defaults_dist: List[int] = []
        loss_dist: List[float] = []

        for _ in range(n_mc):
            # Random bilateral exposures (fraction of bank capital)
            capital = [random.uniform(5e9, 50e9) for _ in range(n_banks)]
            alive = [True] * n_banks

            # Initial defaults
            for i in range(n_banks):
                if random.random() < default_probability:
                    alive[i] = False

            # Cascade rounds
            for _ in range(n_rounds):
                new_defaults = []
                for i in range(n_banks):
                    if not alive[i]:
                        continue
                    loss_from_defaults = sum(
                        capital[j] * exposure_pct * random.uniform(0.3, 0.7)
                        for j in range(n_banks)
                        if not alive[j] and j != i
                    )
                    if loss_from_defaults > capital[i] * 0.08:  # CET1 threshold
                        new_defaults.append(i)
                for i in new_defaults:
                    alive[i] = False

            n_defaults = sum(1 for a in alive if not a)
            total_loss = sum(capital[i] for i in range(n_banks) if not alive[i])
            defaults_dist.append(n_defaults)
            loss_dist.append(total_loss)

        avg_defaults = sum(defaults_dist) / len(defaults_dist)
        avg_loss = sum(loss_dist) / len(loss_dist)
        p_systemic = sum(1 for d in defaults_dist if d >= n_banks * 0.3) / len(defaults_dist)

        return {
            "n_banks": n_banks,
            "n_mc_paths": n_mc,
            "avg_defaults": round(avg_defaults, 1),
            "max_defaults": max(defaults_dist),
            "avg_loss_usd": round(avg_loss, 0),
            "max_loss_usd": round(max(loss_dist), 0),
            "probability_systemic": round(p_systemic, 4),
            "defaults_percentiles": {
                "p5": sorted(defaults_dist)[int(n_mc * 0.05)],
                "p50": sorted(defaults_dist)[int(n_mc * 0.50)],
                "p95": sorted(defaults_dist)[int(n_mc * 0.95)],
            },
        }

    # ------------------------------------------------------------------
    # Liquidity stress model
    # ------------------------------------------------------------------

    def compute_lcr_stress(
        self,
        hqla_usd: float = 50e9,
        net_outflows_30d_usd: float = 45e9,
        deposit_runoff_pct: float = 0.10,
        collateral_haircut_pct: float = 0.15,
    ) -> Dict[str, Any]:
        """Compute stressed Liquidity Coverage Ratio."""
        stressed_hqla = hqla_usd * (1 - collateral_haircut_pct)
        stressed_outflows = net_outflows_30d_usd * (1 + deposit_runoff_pct)
        lcr_baseline = (hqla_usd / max(net_outflows_30d_usd, 1)) * 100
        lcr_stressed = (stressed_hqla / max(stressed_outflows, 1)) * 100
        compliant = lcr_stressed >= 100

        return {
            "hqla_baseline_usd": round(hqla_usd, 0),
            "hqla_stressed_usd": round(stressed_hqla, 0),
            "net_outflows_baseline_usd": round(net_outflows_30d_usd, 0),
            "net_outflows_stressed_usd": round(stressed_outflows, 0),
            "lcr_baseline_pct": round(lcr_baseline, 1),
            "lcr_stressed_pct": round(lcr_stressed, 1),
            "regulatory_minimum_pct": 100.0,
            "compliant": compliant,
            "shortfall_usd": round(max(0, stressed_outflows - stressed_hqla), 0),
            "deposit_runoff_pct": deposit_runoff_pct,
            "collateral_haircut_pct": collateral_haircut_pct,
        }

    def compute_nsfr_stress(
        self,
        available_stable_funding_usd: float = 80e9,
        required_stable_funding_usd: float = 75e9,
        wholesale_freeze_pct: float = 0.20,
    ) -> Dict[str, Any]:
        """Compute stressed Net Stable Funding Ratio."""
        stressed_asf = available_stable_funding_usd * (1 - wholesale_freeze_pct)
        nsfr_baseline = (available_stable_funding_usd / max(required_stable_funding_usd, 1)) * 100
        nsfr_stressed = (stressed_asf / max(required_stable_funding_usd, 1)) * 100
        compliant = nsfr_stressed >= 100

        return {
            "asf_baseline_usd": round(available_stable_funding_usd, 0),
            "asf_stressed_usd": round(stressed_asf, 0),
            "rsf_usd": round(required_stable_funding_usd, 0),
            "nsfr_baseline_pct": round(nsfr_baseline, 1),
            "nsfr_stressed_pct": round(nsfr_stressed, 1),
            "regulatory_minimum_pct": 100.0,
            "compliant": compliant,
            "shortfall_usd": round(max(0, required_stable_funding_usd - stressed_asf), 0),
            "wholesale_freeze_pct": wholesale_freeze_pct,
        }

    # ------------------------------------------------------------------
    # Capital adequacy
    # ------------------------------------------------------------------

    def compute_capital_impact(
        self,
        cet1_capital_usd: float = 30e9,
        rwa_usd: float = 300e9,
        scenario_loss_usd: float = 10e9,
        rwa_inflation_pct: float = 0.10,
    ) -> Dict[str, Any]:
        """Compute capital adequacy impact from stress scenario."""
        cet1_ratio_baseline = (cet1_capital_usd / max(rwa_usd, 1)) * 100
        post_stress_cet1 = cet1_capital_usd - scenario_loss_usd
        post_stress_rwa = rwa_usd * (1 + rwa_inflation_pct)
        cet1_ratio_stressed = (post_stress_cet1 / max(post_stress_rwa, 1)) * 100

        return {
            "cet1_capital_baseline_usd": round(cet1_capital_usd, 0),
            "cet1_capital_stressed_usd": round(post_stress_cet1, 0),
            "rwa_baseline_usd": round(rwa_usd, 0),
            "rwa_stressed_usd": round(post_stress_rwa, 0),
            "cet1_ratio_baseline_pct": round(cet1_ratio_baseline, 2),
            "cet1_ratio_stressed_pct": round(cet1_ratio_stressed, 2),
            "scenario_loss_usd": round(scenario_loss_usd, 0),
            "capital_buffer_pct": round(max(0, cet1_ratio_stressed - 4.5), 2),  # 4.5% minimum
            "breaches_minimum": cet1_ratio_stressed < 4.5,
            "breaches_buffer": cet1_ratio_stressed < 7.0,  # 4.5% + 2.5% conservation buffer
        }
