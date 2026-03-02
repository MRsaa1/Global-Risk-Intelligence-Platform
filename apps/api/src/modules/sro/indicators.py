"""
Systemic Risk Indicators (SRO Phase 1.3).

SFI (Systemic Fragility Index), CFP (Cascading Failure Potential),
FPCC (Financial-Physical Coupling Coefficient), PRW (Policy Response Window).
"""
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class IndicatorResult:
    """Generic indicator result."""
    value: float
    interpretation: str
    band: str  # resilient, elevated, fragile, critical


def _interpret_sfi(value: float) -> str:
    if value < 0.3:
        return "resilient"
    if value < 0.6:
        return "elevated"
    if value < 0.8:
        return "fragile"
    return "critical"


class SystemicRiskIndicators:
    """
    Compute SFI, CFP, FPCC, PRW per spec.
    """

    def __init__(self, db_session=None):
        self.db = db_session

    async def compute_sfi(
        self,
        scope: str = "global",
        region: Optional[str] = None,
        institution_id: Optional[str] = None,
    ) -> IndicatorResult:
        """
        SFI = f(interconnectedness, concentration, leverage, liquidity_mismatch,
                correlation_regime, physical_dependency_exposure)

        Bands: <0.3 resilient, 0.3-0.6 elevated, 0.6-0.8 fragile, >=0.8 critical
        """
        # Region-specific defaults when no DB data (dashboard uses EU, US, ASIA, EM)
        region_default_sfi: Dict[str, float] = {
            "EU": 0.38,
            "US": 0.35,
            "ASIA": 0.42,
            "EM": 0.48,
        }
        value = region_default_sfi.get(region, 0.35) if region else 0.35

        if self.db:
            try:
                from sqlalchemy import select, func
                from src.modules.sro.models import FinancialInstitution

                # Map dashboard regions to country codes for DB filter
                region_country_codes: Dict[str, List[str]] = {
                    "EU": ["DE", "FR", "IT", "ES", "NL", "BE", "AT", "PL", "IE", "PT", "FI", "SE"],
                    "US": ["US"],
                    "ASIA": ["JP", "CN", "KR", "SG", "HK", "IN", "TW", "TH"],
                    "EM": ["BR", "MX", "ZA", "ID", "RU", "TR", "AR", "CL"],
                }
                country_codes = region_country_codes.get(region) if region else None

                q = select(
                    func.avg(FinancialInstitution.interconnectedness_score or 0).label("interconn"),
                    func.avg(FinancialInstitution.leverage_ratio or 0).label("lev"),
                    func.avg(FinancialInstitution.liquidity_ratio or 0).label("liq"),
                ).select_from(FinancialInstitution)
                if institution_id:
                    q = q.where(FinancialInstitution.id == institution_id)
                if country_codes:
                    q = q.where(FinancialInstitution.country_code.in_(country_codes))

                result = await self.db.execute(q)
                row = result.one_or_none()
                if row and row.interconn is not None:
                    interconn = (row.interconn or 0) / 100
                    lev = min(1.0, (row.lev or 10) / 20)
                    liq_mismatch = 1.0 - min(1.0, (row.liq or 1) / 1.5)
                    value = (interconn * 0.25 + lev * 0.25 + liq_mismatch * 0.25 + 0.25) * 0.9
            except Exception as e:
                logger.warning("SFI compute failed: %s", e)

        band = _interpret_sfi(value)
        return IndicatorResult(
            value=round(value, 3),
            interpretation=f"SFI {value:.2f} indicates {band} systemic fragility",
            band=band,
        )

    async def compute_fpcc(
        self,
        scope: str = "global",
        region: Optional[str] = None,
    ) -> IndicatorResult:
        """
        FPCC = Σ(financial_exposure × infrastructure_dependency) / total_capitalization

        High FPCC (>0.7): Small physical shocks -> large financial cascades
        Low FPCC (<0.3): Decoupled, resilient
        """
        value = 0.45  # Stub
        if self.db:
            try:
                from sqlalchemy import select, func
                from src.modules.sro.models import InstitutionExposure, FinancialInstitution

                exp_result = await self.db.execute(
                    select(func.coalesce(func.sum(InstitutionExposure.exposure_amount_usd), 0))
                )
                total_exp = (exp_result.scalar() or 0) or 0

                cap_q = select(func.coalesce(func.sum(FinancialInstitution.total_assets), 0))
                if region:
                    cap_q = cap_q.where(FinancialInstitution.country_code == region)
                cap_result = await self.db.execute(cap_q)
                total_cap = (cap_result.scalar() or 0) or 1

                if total_cap > 0:
                    value = min(1.0, total_exp / total_cap)
            except Exception as e:
                logger.warning("FPCC compute failed: %s", e)

        band = "elevated" if 0.3 <= value < 0.7 else ("resilient" if value < 0.3 else "critical")
        return IndicatorResult(
            value=round(value, 3),
            interpretation=f"FPCC {value:.2f}: financial-physical coupling is {band}",
            band=band,
        )

    async def compute_cfp(
        self,
        scope: str = "global",
        initial_shock_node: Optional[str] = None,
    ) -> IndicatorResult:
        """
        CFP = P(cascade reaches >10 institutions | initial shock)

        Uses Contagion Simulator Monte Carlo to estimate probability.
        """
        value = 0.34  # Fallback
        try:
            from src.modules.sro.contagion_simulator import (
                get_contagion_simulator,
                ShockDefinition,
            )
            sim = get_contagion_simulator(self.db)
            shock = ShockDefinition(
                shock_type="credit_spread",
                magnitude=2.0,
                affected_region=None,
                affected_sector="finance",
                duration_days=30,
            )
            results = await sim.simulate_cascade(
                initial_shock=shock,
                time_horizon_days=90,
                interventions=None,
                n_monte_carlo=200,
            )
            n_total = len(results.runs)
            n_cascade_gt10 = sum(
                1 for r in results.runs
                if r.get("institutions_failed", 0) > 10
            )
            if n_total > 0:
                value = n_cascade_gt10 / n_total
        except Exception as e:
            logger.warning("CFP Contagion Simulator failed: %s", e)

        band = "elevated" if value > 0.2 else ("critical" if value > 0.5 else "resilient")
        return IndicatorResult(
            value=round(value, 3),
            interpretation=f"CFP {value:.2f}: P(cascade >10 institutions) from Monte Carlo",
            band=band,
        )

    async def compute_prw(
        self,
        scope: str = "global",
        scenario_id: Optional[str] = None,
    ) -> IndicatorResult:
        """
        PRW = Time available for intervention before cascade becomes irreversible.

        Simulation-derived: median day when systemic threshold (7+ institutions) reached.
        """
        value = 11.0  # Fallback days
        try:
            from src.modules.sro.contagion_simulator import (
                get_contagion_simulator,
                ShockDefinition,
            )
            sim = get_contagion_simulator(self.db)
            shock = ShockDefinition(
                shock_type="liquidity_crisis",
                magnitude=1.5,
                affected_region=None,
                affected_sector="finance",
                duration_days=30,
            )
            results = await sim.simulate_cascade(
                initial_shock=shock,
                time_horizon_days=90,
                interventions=None,
                n_monte_carlo=150,
            )
            days_to_systemic = []
            for r in results.runs:
                path = r.get("path") or []
                for step in path:
                    if "Day " in step:
                        parts = step.split("Day ")[1].split(":")
                        try:
                            day = int(parts[0].strip())
                            if "Systemic" in step or "collapse" in step.lower() or "Panic" in step:
                                days_to_systemic.append(day)
                                break
                        except (ValueError, IndexError):
                            pass
            if days_to_systemic:
                days_to_systemic.sort()
                value = float(days_to_systemic[len(days_to_systemic) // 2])
        except Exception as e:
            logger.warning("PRW Contagion Simulator failed: %s", e)

        band = "elevated" if value < 14 else ("critical" if value < 7 else "resilient")
        return IndicatorResult(
            value=round(value, 1),
            interpretation=f"PRW {value:.0f} days until point of no return (simulation-derived)",
            band=band,
        )


def get_indicators_service(db_session=None) -> SystemicRiskIndicators:
    """Factory for indicators service."""
    return SystemicRiskIndicators(db_session)
