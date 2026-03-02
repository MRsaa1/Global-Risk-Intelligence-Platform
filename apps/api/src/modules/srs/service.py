"""SRS module service layer.

Sovereign Risk Shield: Monte Carlo sovereign solvency, multi-scenario runner,
FX/commodity/sanctions stress, regime transition and demographic shift models.
"""
import json
import logging
import math
import random
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .models import SovereignFund, ResourceDeposit, SRSIndicator, SovereignFundStatus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Monte Carlo configuration
# ---------------------------------------------------------------------------
MC_DEFAULT_PATHS = 2000
MC_DEFAULT_HORIZON_YEARS = 5

# Commodity volatilities (annualised) used in resource deposit stress
COMMODITY_VOL: Dict[str, float] = {
    "oil": 0.35,
    "gas": 0.40,
    "minerals": 0.25,
    "gold": 0.18,
    "copper": 0.30,
    "lithium": 0.45,
    "uranium": 0.28,
    "coal": 0.32,
    "iron_ore": 0.30,
    "rare_earth": 0.38,
}

# FX volatility by currency (annual)
FX_VOL: Dict[str, float] = {
    "USD": 0.0,
    "EUR": 0.08,
    "GBP": 0.09,
    "NOK": 0.12,
    "SAR": 0.02,
    "AED": 0.02,
    "KWD": 0.03,
    "CNY": 0.06,
    "RUB": 0.25,
    "TRY": 0.30,
    "BRL": 0.18,
    "INR": 0.08,
    "JPY": 0.10,
}


def _percentile(values: List[float], pct: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * pct
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return s[int(k)]
    return s[f] * (c - k) + s[c] * (k - f)


class SRSService:
    """Service for Sovereign Risk Shield operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.module_namespace = "srs"

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    async def list_funds(
        self,
        country_code: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[SovereignFund]:
        q = select(SovereignFund).order_by(SovereignFund.name)
        if country_code:
            q = q.where(SovereignFund.country_code == country_code.upper())
        if status:
            q = q.where(SovereignFund.status == status)
        q = q.limit(limit).offset(offset)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def create_fund(
        self,
        name: str,
        country_code: str,
        description: Optional[str] = None,
        total_assets_usd: Optional[float] = None,
        currency: str = "USD",
        status: str = SovereignFundStatus.ACTIVE.value,
        established_year: Optional[int] = None,
        mandate: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> SovereignFund:
        srs_id = f"SRS-FUND-{country_code.upper()}-{str(uuid4())[:8].upper()}"
        fund = SovereignFund(
            id=str(uuid4()),
            srs_id=srs_id,
            name=name,
            country_code=country_code.upper()[:2],
            description=description,
            total_assets_usd=total_assets_usd,
            currency=currency,
            status=status,
            established_year=established_year,
            mandate=mandate,
            extra_data=json.dumps(extra_data) if extra_data else None,
        )
        self.db.add(fund)
        await self.db.flush()
        return fund

    async def get_fund(self, fund_id: str) -> Optional[SovereignFund]:
        result = await self.db.execute(
            select(SovereignFund).where(
                (SovereignFund.id == fund_id) | (SovereignFund.srs_id == fund_id)
            )
        )
        return result.scalar_one_or_none()

    async def update_fund(
        self,
        fund_id: str,
        **kwargs: Any,
    ) -> Optional[SovereignFund]:
        fund = await self.get_fund(fund_id)
        if not fund:
            return None
        allowed = {"name", "description", "total_assets_usd", "currency", "status", "mandate"}
        for k, v in kwargs.items():
            if k in allowed and v is not None:
                setattr(fund, k, v)
        fund.updated_at = datetime.utcnow()
        await self.db.flush()
        return fund

    async def delete_fund(self, fund_id: str) -> bool:
        fund = await self.get_fund(fund_id)
        if not fund:
            return False
        await self.db.delete(fund)
        await self.db.flush()
        return True

    async def list_deposits(
        self,
        country_code: Optional[str] = None,
        sovereign_fund_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ResourceDeposit]:
        q = select(ResourceDeposit).order_by(ResourceDeposit.name)
        if country_code:
            q = q.where(ResourceDeposit.country_code == country_code.upper())
        if sovereign_fund_id:
            q = q.where(ResourceDeposit.sovereign_fund_id == sovereign_fund_id)
        if resource_type:
            q = q.where(ResourceDeposit.resource_type == resource_type)
        q = q.limit(limit).offset(offset)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def create_deposit(
        self,
        name: str,
        resource_type: str,
        country_code: str,
        sovereign_fund_id: Optional[str] = None,
        estimated_value_usd: Optional[float] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        description: Optional[str] = None,
        extraction_horizon_years: Optional[int] = None,
    ) -> ResourceDeposit:
        srs_id = f"SRS-DEP-{country_code.upper()}-{str(uuid4())[:8].upper()}"
        dep = ResourceDeposit(
            id=str(uuid4()),
            srs_id=srs_id,
            name=name,
            resource_type=resource_type,
            country_code=country_code.upper()[:2],
            sovereign_fund_id=sovereign_fund_id,
            estimated_value_usd=estimated_value_usd,
            latitude=latitude,
            longitude=longitude,
            description=description,
            extraction_horizon_years=extraction_horizon_years,
        )
        self.db.add(dep)
        await self.db.flush()
        return dep

    async def get_deposit(self, deposit_id: str) -> Optional[ResourceDeposit]:
        result = await self.db.execute(
            select(ResourceDeposit).where(
                (ResourceDeposit.id == deposit_id) | (ResourceDeposit.srs_id == deposit_id)
            )
        )
        return result.scalar_one_or_none()

    async def get_indicators(
        self,
        country_code: Optional[str] = None,
        indicator_type: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        q = select(SRSIndicator).order_by(SRSIndicator.measured_at.desc())
        if country_code:
            q = q.where(SRSIndicator.country_code == country_code.upper())
        if indicator_type:
            q = q.where(SRSIndicator.indicator_type == indicator_type)
        q = q.limit(limit)
        result = await self.db.execute(q)
        rows = result.scalars().all()
        return [
            {
                "id": r.id,
                "country_code": r.country_code,
                "indicator_type": r.indicator_type,
                "value": r.value,
                "unit": r.unit,
                "source": r.source,
                "measured_at": r.measured_at.isoformat() if r.measured_at else None,
            }
            for r in rows
        ]

    async def store_indicator(
        self,
        country_code: str,
        indicator_type: str,
        value: float,
        unit: Optional[str] = None,
        source: Optional[str] = None,
    ) -> SRSIndicator:
        ind = SRSIndicator(
            id=str(uuid4()),
            country_code=country_code.upper()[:2],
            indicator_type=indicator_type,
            value=value,
            unit=unit,
            source=source,
            measured_at=datetime.utcnow(),
        )
        self.db.add(ind)
        await self.db.flush()
        return ind

    # ------------------------------------------------------------------
    # Aggregations
    # ------------------------------------------------------------------

    async def get_country_summary(self, country_code: str) -> Dict[str, Any]:
        """Aggregate summary for a single country: total wealth, fund count, resource mix."""
        cc = country_code.upper()
        funds = await self.list_funds(country_code=cc, limit=500)
        deposits = await self.list_deposits(country_code=cc, limit=500)
        total_fund_assets = sum(f.total_assets_usd or 0 for f in funds)
        total_deposit_value = sum(d.estimated_value_usd or 0 for d in deposits)
        resource_mix: Dict[str, float] = {}
        for d in deposits:
            resource_mix[d.resource_type] = resource_mix.get(d.resource_type, 0) + (d.estimated_value_usd or 0)
        return {
            "country_code": cc,
            "funds_count": len(funds),
            "deposits_count": len(deposits),
            "total_fund_assets_usd": total_fund_assets,
            "total_deposit_value_usd": total_deposit_value,
            "total_wealth_usd": total_fund_assets + total_deposit_value,
            "resource_mix": resource_mix,
            "active_funds": sum(1 for f in funds if f.status == SovereignFundStatus.ACTIVE.value),
            "frozen_funds": sum(1 for f in funds if f.status == SovereignFundStatus.FROZEN.value),
        }

    async def get_heatmap_data(self) -> List[Dict[str, Any]]:
        """Return per-country wealth data for a heatmap visualization."""
        funds = await self.list_funds(limit=1000)
        deposits = await self.list_deposits(limit=2000)
        countries: Dict[str, Dict[str, float]] = {}
        for f in funds:
            cc = f.country_code
            if cc not in countries:
                countries[cc] = {"fund_assets": 0, "deposit_value": 0, "fund_count": 0, "deposit_count": 0}
            countries[cc]["fund_assets"] += f.total_assets_usd or 0
            countries[cc]["fund_count"] += 1
        for d in deposits:
            cc = d.country_code
            if cc not in countries:
                countries[cc] = {"fund_assets": 0, "deposit_value": 0, "fund_count": 0, "deposit_count": 0}
            countries[cc]["deposit_value"] += d.estimated_value_usd or 0
            countries[cc]["deposit_count"] += 1
        return [
            {
                "country_code": cc,
                "total_wealth_usd": v["fund_assets"] + v["deposit_value"],
                **v,
            }
            for cc, v in sorted(countries.items(), key=lambda x: -(x[1]["fund_assets"] + x[1]["deposit_value"]))
        ]

    # ------------------------------------------------------------------
    # Monte Carlo Sovereign Solvency
    # ------------------------------------------------------------------

    def _mc_fund_paths(
        self,
        initial_value: float,
        currency: str,
        n_paths: int,
        horizon_years: int,
    ) -> List[float]:
        """Simulate terminal fund value paths with FX + market volatility."""
        fx_vol = FX_VOL.get(currency, 0.10)
        equity_vol = 0.15
        combined_vol = math.sqrt(fx_vol ** 2 + equity_vol ** 2)
        drift = 0.03  # conservative real return
        dt = 1.0
        terminals: List[float] = []
        for _ in range(n_paths):
            v = initial_value
            for _ in range(horizon_years):
                shock = random.gauss(0, 1)
                v *= math.exp((drift - 0.5 * combined_vol ** 2) * dt + combined_vol * math.sqrt(dt) * shock)
            terminals.append(v)
        return terminals

    def _mc_deposit_paths(
        self,
        initial_value: float,
        resource_type: str,
        horizon_years: int,
        n_paths: int,
    ) -> List[float]:
        """Simulate terminal deposit value with commodity price volatility."""
        vol = COMMODITY_VOL.get(resource_type.lower(), 0.30)
        drift = 0.01
        dt = 1.0
        terminals: List[float] = []
        for _ in range(n_paths):
            v = initial_value
            for _ in range(horizon_years):
                shock = random.gauss(0, 1)
                v *= math.exp((drift - 0.5 * vol ** 2) * dt + vol * math.sqrt(dt) * shock)
            terminals.append(max(v, 0))
        return terminals

    async def run_scenario(
        self,
        scenario_type: str,
        country_code: Optional[str] = None,
        fund_id: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Run a sovereign risk scenario with Monte Carlo simulation."""
        params = params or {}
        dispatch = {
            "sovereign_solvency_stress": self._scenario_solvency_stress,
            "commodity_shock": self._scenario_commodity_shock,
            "capital_flight": self._scenario_capital_flight,
            "sanctions": self._scenario_sanctions,
            "regime_transition": self._scenario_regime_transition,
            "resource_depletion": self._scenario_resource_depletion,
            "demographic_shift": self._scenario_demographic_shift,
            "fx_crisis": self._scenario_fx_crisis,
        }
        handler = dispatch.get(scenario_type, self._scenario_solvency_stress)
        return await handler(scenario_type, country_code, fund_id, params)

    async def run_batch_scenarios(
        self,
        scenario_types: List[str],
        country_code: Optional[str] = None,
        fund_id: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Run multiple scenarios and return comparative results."""
        results = []
        for st in scenario_types:
            r = await self.run_scenario(st, country_code, fund_id, params)
            results.append(r)
        return results

    # ------------------------------------------------------------------
    # Scenario implementations
    # ------------------------------------------------------------------

    async def _load_context(
        self,
        country_code: Optional[str],
        fund_id: Optional[str],
    ) -> tuple:
        funds: List[SovereignFund] = []
        if fund_id:
            f = await self.get_fund(fund_id)
            if f:
                funds = [f]
        else:
            funds = await self.list_funds(country_code=country_code, limit=50)
        deposits = await self.list_deposits(
            country_code=country_code,
            sovereign_fund_id=funds[0].id if len(funds) == 1 else None,
            limit=500,
        )
        return funds, deposits

    async def _scenario_solvency_stress(
        self, scenario_type: str, country_code: Optional[str],
        fund_id: Optional[str], params: Dict[str, Any],
    ) -> Dict[str, Any]:
        n_paths = int(params.get("mc_paths", MC_DEFAULT_PATHS))
        horizon = int(params.get("horizon_years", MC_DEFAULT_HORIZON_YEARS))
        stress_shock = float(params.get("stress_shock", 0.20))

        funds, deposits = await self._load_context(country_code, fund_id)
        total_assets = sum(f.total_assets_usd or 0 for f in funds)
        total_deposit = sum(d.estimated_value_usd or 0 for d in deposits)
        wealth_baseline = total_assets + total_deposit

        # Monte Carlo on fund assets
        fund_terminals: List[float] = []
        for f in funds:
            if f.total_assets_usd and f.total_assets_usd > 0:
                fund_terminals.extend(
                    self._mc_fund_paths(f.total_assets_usd, f.currency, max(n_paths // max(len(funds), 1), 200), horizon)
                )

        # Monte Carlo on deposits
        dep_terminals: List[float] = []
        for d in deposits:
            if d.estimated_value_usd and d.estimated_value_usd > 0:
                dep_terminals.extend(
                    self._mc_deposit_paths(d.estimated_value_usd, d.resource_type, horizon, max(n_paths // max(len(deposits), 1), 200))
                )

        # Combine terminal wealth
        if fund_terminals or dep_terminals:
            # Per-path total wealth
            per_fund = len(fund_terminals) // max(len(funds), 1) if funds else 0
            per_dep = len(dep_terminals) // max(len(deposits), 1) if deposits else 0
            n_combined = min(len(fund_terminals), len(dep_terminals)) if (fund_terminals and dep_terminals) else max(len(fund_terminals), len(dep_terminals))
            combined = []
            for i in range(n_combined):
                fv = fund_terminals[i % len(fund_terminals)] if fund_terminals else 0
                dv = dep_terminals[i % len(dep_terminals)] if dep_terminals else 0
                combined.append(fv + dv)
        else:
            combined = [wealth_baseline * (1 - stress_shock)]

        # Apply deterministic stress overlay
        stressed = [v * (1 - stress_shock) for v in combined]

        mean_wealth = sum(stressed) / len(stressed) if stressed else 0
        solvency_score = max(0.0, min(1.0, 0.5 + (mean_wealth / max(wealth_baseline, 1)) * 0.5)) if wealth_baseline > 0 else 0.75

        regime_stability = float(params.get("regime_stability_index", 0.6 + 0.2 * min(1.0, len(funds) / 5)))
        digital_sovereignty = float(params.get("digital_sovereignty_index", 0.5 + 0.2 * min(1.0, len(deposits) / 10)))

        return {
            "scenario_type": scenario_type,
            "country_code": country_code,
            "fund_id": fund_id,
            "status": "completed",
            "result": {
                "solvency_score": round(max(0, min(1, solvency_score)), 4),
                "regime_stability_index": round(max(0, min(1, regime_stability)), 4),
                "digital_sovereignty_index": round(max(0, min(1, digital_sovereignty)), 4),
                "wealth_baseline_usd": round(wealth_baseline, 0),
                "wealth_mean_stressed_usd": round(mean_wealth, 0),
                "wealth_p5_usd": round(_percentile(stressed, 0.05), 0),
                "wealth_p25_usd": round(_percentile(stressed, 0.25), 0),
                "wealth_p50_usd": round(_percentile(stressed, 0.50), 0),
                "wealth_p75_usd": round(_percentile(stressed, 0.75), 0),
                "wealth_p95_usd": round(_percentile(stressed, 0.95), 0),
                "mc_paths": len(stressed),
                "horizon_years": horizon,
                "stress_shock_applied": stress_shock,
                "funds_count": len(funds),
                "deposits_count": len(deposits),
            },
            "run_at": datetime.utcnow().isoformat(),
        }

    async def _scenario_commodity_shock(
        self, scenario_type: str, country_code: Optional[str],
        fund_id: Optional[str], params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Commodity price crash: oil/gas -40%, minerals -25%."""
        price_shocks = params.get("price_shocks", {"oil": -0.40, "gas": -0.40, "minerals": -0.25})
        funds, deposits = await self._load_context(country_code, fund_id)
        total_dep_baseline = sum(d.estimated_value_usd or 0 for d in deposits)
        total_dep_stressed = 0.0
        resource_impacts: Dict[str, Dict[str, float]] = {}
        for d in deposits:
            shock = price_shocks.get(d.resource_type.lower(), -0.15)
            stressed_val = (d.estimated_value_usd or 0) * (1 + shock)
            total_dep_stressed += stressed_val
            if d.resource_type not in resource_impacts:
                resource_impacts[d.resource_type] = {"baseline": 0, "stressed": 0, "shock": shock}
            resource_impacts[d.resource_type]["baseline"] += d.estimated_value_usd or 0
            resource_impacts[d.resource_type]["stressed"] += stressed_val

        total_fund = sum(f.total_assets_usd or 0 for f in funds)
        wealth_baseline = total_fund + total_dep_baseline
        wealth_stressed = total_fund + total_dep_stressed
        solvency = max(0, min(1, wealth_stressed / max(wealth_baseline, 1)))

        return {
            "scenario_type": scenario_type,
            "country_code": country_code,
            "fund_id": fund_id,
            "status": "completed",
            "result": {
                "solvency_score": round(solvency, 4),
                "wealth_baseline_usd": round(wealth_baseline, 0),
                "wealth_stressed_usd": round(wealth_stressed, 0),
                "loss_usd": round(wealth_baseline - wealth_stressed, 0),
                "loss_pct": round((1 - solvency) * 100, 2),
                "resource_impacts": {k: {kk: round(vv, 0) for kk, vv in v.items()} for k, v in resource_impacts.items()},
                "funds_count": len(funds),
                "deposits_count": len(deposits),
            },
            "run_at": datetime.utcnow().isoformat(),
        }

    async def _scenario_capital_flight(
        self, scenario_type: str, country_code: Optional[str],
        fund_id: Optional[str], params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Capital flight: fund assets decline by outflow_rate over withdrawal_years."""
        outflow_rate = float(params.get("annual_outflow_rate", 0.10))
        years = int(params.get("withdrawal_years", 3))
        funds, deposits = await self._load_context(country_code, fund_id)
        total_fund = sum(f.total_assets_usd or 0 for f in funds)
        remaining = total_fund
        yearly_path = [total_fund]
        for _ in range(years):
            remaining *= (1 - outflow_rate)
            yearly_path.append(remaining)
        total_dep = sum(d.estimated_value_usd or 0 for d in deposits)
        return {
            "scenario_type": scenario_type,
            "country_code": country_code,
            "fund_id": fund_id,
            "status": "completed",
            "result": {
                "fund_assets_baseline_usd": round(total_fund, 0),
                "fund_assets_terminal_usd": round(remaining, 0),
                "yearly_path_usd": [round(v, 0) for v in yearly_path],
                "total_outflow_usd": round(total_fund - remaining, 0),
                "total_wealth_terminal_usd": round(remaining + total_dep, 0),
                "annual_outflow_rate": outflow_rate,
                "withdrawal_years": years,
                "funds_count": len(funds),
            },
            "run_at": datetime.utcnow().isoformat(),
        }

    async def _scenario_sanctions(
        self, scenario_type: str, country_code: Optional[str],
        fund_id: Optional[str], params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Sanctions: freeze a percentage of fund assets and restrict deposit exports."""
        freeze_pct = float(params.get("freeze_pct", 0.50))
        export_restriction = float(params.get("export_restriction", 0.30))
        funds, deposits = await self._load_context(country_code, fund_id)
        total_fund = sum(f.total_assets_usd or 0 for f in funds)
        total_dep = sum(d.estimated_value_usd or 0 for d in deposits)
        frozen_assets = total_fund * freeze_pct
        accessible_fund = total_fund - frozen_assets
        restricted_dep = total_dep * export_restriction
        effective_dep = total_dep - restricted_dep
        return {
            "scenario_type": scenario_type,
            "country_code": country_code,
            "fund_id": fund_id,
            "status": "completed",
            "result": {
                "fund_assets_total_usd": round(total_fund, 0),
                "frozen_assets_usd": round(frozen_assets, 0),
                "accessible_fund_usd": round(accessible_fund, 0),
                "deposit_value_total_usd": round(total_dep, 0),
                "restricted_deposit_usd": round(restricted_dep, 0),
                "effective_deposit_usd": round(effective_dep, 0),
                "total_accessible_wealth_usd": round(accessible_fund + effective_dep, 0),
                "freeze_pct": freeze_pct,
                "export_restriction": export_restriction,
                "solvency_score": round(max(0, min(1, (accessible_fund + effective_dep) / max(total_fund + total_dep, 1))), 4),
            },
            "run_at": datetime.utcnow().isoformat(),
        }

    async def _scenario_regime_transition(
        self, scenario_type: str, country_code: Optional[str],
        fund_id: Optional[str], params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Regime transition: governance shock reduces fund management efficiency."""
        efficiency_loss = float(params.get("efficiency_loss", 0.25))
        transition_years = int(params.get("transition_years", 2))
        funds, deposits = await self._load_context(country_code, fund_id)
        total_fund = sum(f.total_assets_usd or 0 for f in funds)
        total_dep = sum(d.estimated_value_usd or 0 for d in deposits)
        post_transition_fund = total_fund * (1 - efficiency_loss)
        regime_stability = max(0, 1.0 - efficiency_loss - 0.1 * transition_years)
        return {
            "scenario_type": scenario_type,
            "country_code": country_code,
            "fund_id": fund_id,
            "status": "completed",
            "result": {
                "fund_assets_baseline_usd": round(total_fund, 0),
                "fund_assets_post_transition_usd": round(post_transition_fund, 0),
                "efficiency_loss": efficiency_loss,
                "transition_years": transition_years,
                "regime_stability_index": round(max(0, min(1, regime_stability)), 4),
                "total_wealth_post_usd": round(post_transition_fund + total_dep, 0),
            },
            "run_at": datetime.utcnow().isoformat(),
        }

    async def _scenario_resource_depletion(
        self, scenario_type: str, country_code: Optional[str],
        fund_id: Optional[str], params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Model resource depletion over extraction horizon."""
        accelerated_depletion = float(params.get("depletion_acceleration", 1.5))
        funds, deposits = await self._load_context(country_code, fund_id)
        depleted = []
        for d in deposits:
            horizon = d.extraction_horizon_years or 30
            adj_horizon = max(1, horizon / accelerated_depletion)
            remaining_pct = max(0, 1 - (5 / adj_horizon))  # 5-year lookahead
            depleted.append({
                "name": d.name,
                "resource_type": d.resource_type,
                "baseline_usd": round(d.estimated_value_usd or 0, 0),
                "remaining_usd": round((d.estimated_value_usd or 0) * remaining_pct, 0),
                "remaining_pct": round(remaining_pct * 100, 1),
                "original_horizon_years": horizon,
                "adjusted_horizon_years": round(adj_horizon, 1),
            })
        return {
            "scenario_type": scenario_type,
            "country_code": country_code,
            "status": "completed",
            "result": {
                "deposits": depleted,
                "total_baseline_usd": round(sum(x["baseline_usd"] for x in depleted), 0),
                "total_remaining_usd": round(sum(x["remaining_usd"] for x in depleted), 0),
                "depletion_acceleration": accelerated_depletion,
            },
            "run_at": datetime.utcnow().isoformat(),
        }

    async def _scenario_demographic_shift(
        self, scenario_type: str, country_code: Optional[str],
        fund_id: Optional[str], params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Demographic shift: aging population increases fiscal burden on sovereign wealth."""
        dependency_ratio_increase = float(params.get("dependency_ratio_increase", 0.15))
        fiscal_burden_pct = float(params.get("fiscal_burden_pct", 0.08))
        years = int(params.get("years", 10))
        funds, deposits = await self._load_context(country_code, fund_id)
        total_fund = sum(f.total_assets_usd or 0 for f in funds)
        annual_draw = total_fund * fiscal_burden_pct * (1 + dependency_ratio_increase)
        remaining = total_fund
        path = [total_fund]
        for _ in range(years):
            remaining -= annual_draw
            remaining = max(0, remaining)
            path.append(remaining)
        return {
            "scenario_type": scenario_type,
            "country_code": country_code,
            "status": "completed",
            "result": {
                "fund_assets_baseline_usd": round(total_fund, 0),
                "fund_assets_terminal_usd": round(remaining, 0),
                "annual_fiscal_draw_usd": round(annual_draw, 0),
                "yearly_path_usd": [round(v, 0) for v in path],
                "dependency_ratio_increase": dependency_ratio_increase,
                "fiscal_burden_pct": fiscal_burden_pct,
                "years": years,
                "depletion_year": next((i for i, v in enumerate(path) if v <= 0), None),
            },
            "run_at": datetime.utcnow().isoformat(),
        }

    async def _scenario_fx_crisis(
        self, scenario_type: str, country_code: Optional[str],
        fund_id: Optional[str], params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """FX crisis: local currency devaluation impacts USD-denominated value."""
        devaluation_pct = float(params.get("devaluation_pct", 0.30))
        funds, deposits = await self._load_context(country_code, fund_id)
        # Non-USD funds are exposed to FX
        usd_funds = [f for f in funds if f.currency == "USD"]
        non_usd_funds = [f for f in funds if f.currency != "USD"]
        usd_total = sum(f.total_assets_usd or 0 for f in usd_funds)
        non_usd_total = sum(f.total_assets_usd or 0 for f in non_usd_funds)
        non_usd_stressed = non_usd_total * (1 - devaluation_pct)
        total_dep = sum(d.estimated_value_usd or 0 for d in deposits)
        return {
            "scenario_type": scenario_type,
            "country_code": country_code,
            "status": "completed",
            "result": {
                "usd_denominated_fund_assets": round(usd_total, 0),
                "local_currency_fund_assets_baseline": round(non_usd_total, 0),
                "local_currency_fund_assets_stressed": round(non_usd_stressed, 0),
                "fx_loss_usd": round(non_usd_total - non_usd_stressed, 0),
                "devaluation_pct": devaluation_pct,
                "total_wealth_stressed_usd": round(usd_total + non_usd_stressed + total_dep, 0),
                "currencies_exposed": list({f.currency for f in non_usd_funds}),
            },
            "run_at": datetime.utcnow().isoformat(),
        }
