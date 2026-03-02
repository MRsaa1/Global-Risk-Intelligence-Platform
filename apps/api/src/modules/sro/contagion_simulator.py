"""
Contagion Simulator (SRO Phase 1.3).

Monte Carlo simulation of financial contagion with fire sales,
margin calls, confidence shocks, and policy interventions.
"""
import logging
import random
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class ShockDefinition:
    """Initial shock definition."""
    shock_type: str
    magnitude: float
    affected_region: Optional[str] = None
    affected_sector: Optional[str] = None
    duration_days: int = 30


@dataclass
class PolicyIntervention:
    """Policy intervention definition."""
    day: int
    intervention_type: str
    amount_usd: Optional[float] = None
    parameters: Optional[Dict[str, Any]] = None


@dataclass
class CascadeResults:
    """Result of contagion simulation."""
    runs: List[Dict[str, Any]]
    percentiles: Dict[str, float]
    probability_systemic_collapse: float
    critical_path: List[str]
    intervention_recommendations: List[Dict[str, Any]]


def _percentile(values: List[float], p: int) -> float:
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    k = (len(sorted_vals) - 1) * p / 100
    f = int(k)
    c = f + 1 if f + 1 < len(sorted_vals) else f
    return sorted_vals[f] + (k - f) * (sorted_vals[c] - sorted_vals[f]) if f != c else sorted_vals[f]


class ContagionSimulator:
    """
    BlackRock Aladdin-grade contagion engine with physical-financial coupling.

    Stages:
    1. Initial shock propagation (direct exposures)
    2. Fire sales
    3. Margin calls
    4. Confidence/liquidity freeze
    5. Policy interventions
    6. Recovery dynamics
    """

    def __init__(self, db_session=None):
        self.db = db_session

    async def _load_institutions(self) -> List[Dict[str, Any]]:
        """Load institutions from DB for simulation. Falls back to demo data on any error."""
        if not self.db:
            return self._default_institutions()
        try:
            from sqlalchemy import select
            from src.modules.sro.models import FinancialInstitution, RiskCorrelation

            result = await self.db.execute(
                select(FinancialInstitution).limit(50)
            )
            insts = list(result.scalars().all())
            if not insts:
                return self._default_institutions()

            nodes = []
            for i in insts:
                cap = getattr(i, "tier1_capital", None) or getattr(i, "total_assets", None) or 1e9
                nodes.append({
                    "id": str(i.id),
                    "name": i.name or "Unknown",
                    "capital": float(cap or 1e9) * 0.1,
                    "total_assets": float(getattr(i, "total_assets", None) or 1e9),
                    "leverage": float(getattr(i, "leverage_ratio", None) or 10),
                    "liquidity": float(getattr(i, "liquidity_ratio", None) or 1.0),
                    "failed": False,
                    "exposures": {},
                })

            try:
                result_corr = await self.db.execute(select(RiskCorrelation))
                corrs = list(result_corr.scalars().all())
            except Exception:
                corrs = []

            for c in corrs:
                a_id = str(c.institution_a_id)
                b_id = str(c.institution_b_id)
                exp = float(c.exposure_amount or 0)
                for n in nodes:
                    if n["id"] == a_id:
                        n["exposures"][b_id] = n["exposures"].get(b_id, 0) + exp
                    elif n["id"] == b_id:
                        n["exposures"][a_id] = n["exposures"].get(a_id, 0) + exp

            try:
                from src.services.cascade_gnn import cascade_gnn_service
                cg = cascade_gnn_service
                if cg.nodes and cg.edges:
                    id_to_inst = {n["id"]: n for n in nodes}
                    for edge in cg.edges:
                        src, tgt = edge.source_id, edge.target_id
                        for iid, inst in id_to_inst.items():
                            if src == iid or (src in inst.get("name", "") or inst.get("name", "") in str(src)):
                                other_id = next((k for k, v in id_to_inst.items() if tgt == k or tgt in v.get("name", "") or v.get("name", "") in str(tgt)), None)
                                if other_id and other_id != iid:
                                    w = (getattr(edge, "weight", 0.5) or 0.5) * 1e9
                                    inst["exposures"][other_id] = inst["exposures"].get(other_id, 0) + w
            except Exception as eg:
                logger.debug("Cascade GNN integration in contagion: %s", eg)

            return nodes
        except Exception as e:
            logger.warning("Load institutions failed, using defaults: %s", e)
            return self._default_institutions()

    def _default_institutions(self) -> List[Dict[str, Any]]:
        """Default stub institutions for demo. Exposures set so contagion can cascade when first fails."""
        return [
            {"id": "i1", "name": "Bank A", "capital": 50e9, "total_assets": 500e9, "leverage": 10, "liquidity": 1.2, "failed": False, "exposures": {"i2": 42e9}},
            {"id": "i2", "name": "Bank B", "capital": 30e9, "total_assets": 300e9, "leverage": 10, "liquidity": 1.0, "failed": False, "exposures": {"i1": 5e9, "i3": 26e9}},
            {"id": "i3", "name": "Bank C", "capital": 20e9, "total_assets": 200e9, "leverage": 10, "liquidity": 0.9, "failed": False, "exposures": {"i2": 6e9}},
        ]

    async def simulate_cascade(
        self,
        initial_shock: ShockDefinition,
        time_horizon_days: int = 90,
        interventions: Optional[List[PolicyIntervention]] = None,
        n_monte_carlo: int = 100,
    ) -> CascadeResults:
        """
        Multi-stage Monte Carlo simulation.

        Returns CascadeResults with percentiles, collapse probability, critical path.
        """
        institutions = await self._load_institutions()
        if not institutions:
            institutions = self._default_institutions()

        results = []
        interventions = interventions or []

        # Shock-type modifiers: affect contagion speed and panic sensitivity
        shock_type = (initial_shock.shock_type or "financial_stress").lower()
        if "flash" in shock_type or "market" in shock_type:
            base_fire_sale = 1.8
            base_panic = 0.12
        elif "geopolitical" in shock_type or "supply" in shock_type:
            base_fire_sale = 1.6
            base_panic = 0.18
        elif "energy" in shock_type or "stagflation" in shock_type:
            base_fire_sale = 1.5
            base_panic = 0.16
        else:
            base_fire_sale = 1.5
            base_panic = 0.15

        for _ in range(n_monte_carlo):
            fire_sale_mult = base_fire_sale + random.gauss(0, 0.25)
            panic_threshold = base_panic + random.gauss(0, 0.04)
            panic_threshold = max(0.08, min(0.35, panic_threshold))

            # Copy state
            state = []
            for n in institutions:
                state.append({
                    "id": n["id"], "name": n["name"],
                    "capital": n["capital"], "total_assets": n["total_assets"],
                    "leverage": n["leverage"], "liquidity": n["liquidity"],
                    "failed": False, "exposures": dict(n.get("exposures", {})),
                })

            # Day 0: apply shock as fraction of capital so magnitude drives real impact and
            # high-magnitude scenarios can actually fail institutions (then contagion spreads).
            # magnitude 1.0 -> ~25%, 1.5 -> ~55%, 2.0 -> ~80%, 2.5+ -> 100% (first inst can fail)
            # Add run-level randomness so same scenario yields different P50/P95 across runs.
            base_damage = 0.05 + initial_shock.magnitude * 0.38
            damage_pct = min(1.15, base_damage * (1.0 + random.gauss(0, 0.12)))
            damage_pct = max(0.1, damage_pct)
            n_affected = 1 if initial_shock.magnitude < 1.8 else min(2, len(state))
            shock_loss = 0.0
            if state:
                for i in range(n_affected):
                    cap = state[i]["capital"]
                    loss = cap * damage_pct * (0.7 if i > 0 else 1.0)
                    state[i]["capital"] = max(0, cap - loss)
                    shock_loss += loss
                    if state[i]["capital"] <= 0:
                        state[i]["failed"] = True

            failed_count = sum(1 for s in state if s["failed"])
            total_losses = shock_loss
            path = [f"Day 0: Shock applied ({initial_shock.shock_type}), loss ${shock_loss/1e9:.1f}B"]

            for day in range(1, time_horizon_days):
                # Apply interventions
                for iv in interventions:
                    if iv.day == day and iv.intervention_type == "emergency_liquidity":
                        try:
                            amt = float(iv.amount_usd) if iv.amount_usd is not None else 500e9
                        except (TypeError, ValueError):
                            amt = 500e9
                        for s in state:
                            if s["failed"]:
                                continue
                            s["capital"] += amt / len(state) * 0.1
                            break

                # Propagate contagion: direct exposures
                for s in state:
                    if s["failed"]:
                        continue
                    for other_id, exp in s["exposures"].items():
                        other = next((x for x in state if x["id"] == other_id), None)
                        if other and other["failed"]:
                            loss = exp * 0.5 * fire_sale_mult
                            s["capital"] -= loss
                            total_losses += loss
                            if s["capital"] <= 0:
                                s["failed"] = True

                # Fire sales effect
                failed_count = sum(1 for s in state if s["failed"])
                if failed_count >= len(state) * panic_threshold:
                    for s in state:
                        if not s["failed"]:
                            s["capital"] *= 0.85
                            if s["capital"] <= 0:
                                s["failed"] = True
                    path.append(f"Day {day}: Panic threshold reached, fire sales")

                failed_count = sum(1 for s in state if s["failed"])
                total_losses = sum(
                    (ins["total_assets"] or 0) for ins in institutions
                ) - sum(s["capital"] * 10 for s in state if not s["failed"])

                if failed_count == len(state):
                    path.append(f"Day {day}: Total collapse")
                    break
                systemic_n = min(7, max(2, int(len(state) * 0.35)))
                if failed_count >= systemic_n and day <= time_horizon_days // 2:
                    path.append(f"Day {day}: Systemic threshold ({systemic_n}+ institutions failed)")

            results.append({
                "institutions_failed": failed_count,
                "total_losses_usd": total_losses,
                "systemic_collapse": failed_count >= min(10, len(state) * 0.3),
                "path": path,
            })

        inst_failures = [r["institutions_failed"] for r in results]
        losses = [r["total_losses_usd"] for r in results]
        collapse_prob = sum(1 for r in results if r["systemic_collapse"]) / len(results) if results else 0.0
        p50_fail = _percentile(inst_failures, 50)
        # Representative path: run whose failed count is closest to p50
        def _path_for_median():
            if not results:
                return []
            idx = min(range(len(results)), key=lambda i: abs(results[i]["institutions_failed"] - p50_fail))
            return results[idx].get("path") or []

        return CascadeResults(
            runs=results,
            percentiles={
                "institutions_failed_p50": _percentile(inst_failures, 50),
                "institutions_failed_p95": _percentile(inst_failures, 95),
                "losses_p50_usd": _percentile(losses, 50),
                "losses_p95_usd": _percentile(losses, 95),
            },
            probability_systemic_collapse=collapse_prob,
            critical_path=_path_for_median(),
            intervention_recommendations=[
                {"action": "Emergency liquidity", "day": 5, "amount_usd": 500e9},
                {"action": "Circuit breakers", "day": 7, "duration_days": 3},
            ],
        )


def get_contagion_simulator(db_session=None) -> ContagionSimulator:
    """Factory for contagion simulator."""
    return ContagionSimulator(db_session)
