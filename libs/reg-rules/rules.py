"""
Regulatory rule implementations.

Each rule class implements a specific regulatory framework
with versioning and jurisdiction support.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

from libs.dsl_schema.schema import Jurisdiction, RegulatoryFramework


class BaseRegulatoryRule(ABC):
    """Base class for all regulatory rules."""

    def __init__(
        self,
        framework: RegulatoryFramework,
        jurisdiction: Jurisdiction,
        rule_version: str = "latest",
        parameters: Optional[Dict[str, Any]] = None,
    ):
        self.framework = framework
        self.jurisdiction = jurisdiction
        self.rule_version = rule_version
        self.parameters = parameters or {}
        self._validate_parameters()

    @abstractmethod
    def _validate_parameters(self) -> None:
        """Validate rule parameters."""
        pass

    @abstractmethod
    def calculate(self, portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate regulatory metric for given portfolio."""
        pass

    @abstractmethod
    def get_required_fields(self) -> list[str]:
        """Return list of required portfolio fields."""
        pass


class BaselIVRule(BaseRegulatoryRule):
    """Basel IV capital requirements rule."""

    def __init__(self, jurisdiction: Jurisdiction, **kwargs):
        super().__init__(RegulatoryFramework.BASEL_IV, jurisdiction, **kwargs)

    def _validate_parameters(self) -> None:
        """Validate Basel IV parameters."""
        # Minimum CET1 ratio typically 4.5% + buffers
        min_cet1 = self.parameters.get("min_cet1_ratio", 0.045)
        if not 0.0 <= min_cet1 <= 1.0:
            raise ValueError("min_cet1_ratio must be between 0 and 1")

    def calculate(self, portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate Basel IV capital requirements."""
        # Placeholder implementation
        rwa = portfolio_data.get("risk_weighted_assets", 0.0)
        cet1 = portfolio_data.get("common_equity_tier1", 0.0)
        min_cet1_ratio = self.parameters.get("min_cet1_ratio", 0.045)

        cet1_ratio = cet1 / rwa if rwa > 0 else 0.0
        capital_requirement = rwa * min_cet1_ratio
        capital_surplus = cet1 - capital_requirement

        return {
            "cet1_ratio": cet1_ratio,
            "capital_requirement": capital_requirement,
            "capital_surplus": capital_surplus,
            "rwa": rwa,
            "cet1": cet1,
        }

    def get_required_fields(self) -> list[str]:
        """Return required fields for Basel IV calculation."""
        return ["risk_weighted_assets", "common_equity_tier1"]


class FRTBRule(BaseRegulatoryRule):
    """FRTB (Fundamental Review of the Trading Book) rule."""

    def __init__(self, jurisdiction: Jurisdiction, approach: str = "SA", **kwargs):
        super().__init__(
            RegulatoryFramework.FRTB_SA if approach == "SA" else RegulatoryFramework.FRTB_IMA,
            jurisdiction,
            **kwargs,
        )
        self.approach = approach

    def _validate_parameters(self) -> None:
        """Validate FRTB parameters."""
        if self.approach not in ["SA", "IMA"]:
            raise ValueError("FRTB approach must be 'SA' or 'IMA'")

    def calculate(self, portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate FRTB capital requirement."""
        # Placeholder implementation
        if self.approach == "SA":
            return self._calculate_sa(portfolio_data)
        else:
            return self._calculate_ima(portfolio_data)

    def _calculate_sa(self, portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate FRTB Standardized Approach."""
        # Simplified SA calculation
        sensitivities = portfolio_data.get("sensitivities", {})
        capital_charge = sum(abs(v) for v in sensitivities.values()) * 0.1  # Simplified

        return {
            "capital_charge": capital_charge,
            "approach": "SA",
            "sensitivities": sensitivities,
        }

    def _calculate_ima(self, portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate FRTB Internal Models Approach."""
        # Placeholder for IMA
        pnl_vector = portfolio_data.get("pnl_vector", [])
        es_97_5 = portfolio_data.get("expected_shortfall_97_5", 0.0)

        return {
            "capital_charge": es_97_5 * 1.5,  # Simplified with multiplier
            "approach": "IMA",
            "es_97_5": es_97_5,
        }

    def get_required_fields(self) -> list[str]:
        """Return required fields for FRTB calculation."""
        if self.approach == "SA":
            return ["sensitivities"]
        else:
            return ["pnl_vector", "expected_shortfall_97_5"]


class IRRBBRule(BaseRegulatoryRule):
    """Interest Rate Risk in the Banking Book rule."""

    def __init__(self, jurisdiction: Jurisdiction, **kwargs):
        super().__init__(RegulatoryFramework.IRRBB, jurisdiction, **kwargs)

    def _validate_parameters(self) -> None:
        """Validate IRRBB parameters."""
        pass

    def calculate(self, portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate IRRBB metric."""
        # Placeholder implementation
        ev_parallel = portfolio_data.get("ev_parallel_shock", 0.0)
        ev_steepening = portfolio_data.get("ev_steepening_shock", 0.0)
        ev_flattening = portfolio_data.get("ev_flattening_shock", 0.0)

        max_ev = max(abs(ev_parallel), abs(ev_steepening), abs(ev_flattening))

        return {
            "max_ev": max_ev,
            "ev_parallel": ev_parallel,
            "ev_steepening": ev_steepening,
            "ev_flattening": ev_flattening,
        }

    def get_required_fields(self) -> list[str]:
        """Return required fields for IRRBB calculation."""
        return [
            "ev_parallel_shock",
            "ev_steepening_shock",
            "ev_flattening_shock",
        ]


class LCRRule(BaseRegulatoryRule):
    """Liquidity Coverage Ratio rule."""

    def __init__(self, jurisdiction: Jurisdiction, **kwargs):
        super().__init__(RegulatoryFramework.LCR, jurisdiction, **kwargs)

    def _validate_parameters(self) -> None:
        """Validate LCR parameters."""
        min_lcr = self.parameters.get("min_lcr", 1.0)
        if min_lcr < 0:
            raise ValueError("min_lcr must be non-negative")

    def calculate(self, portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate LCR."""
        hqla = portfolio_data.get("high_quality_liquid_assets", 0.0)
        net_cash_outflows = portfolio_data.get("net_cash_outflows_30d", 0.0)

        lcr = hqla / net_cash_outflows if net_cash_outflows > 0 else float("inf")
        min_lcr = self.parameters.get("min_lcr", 1.0)
        lcr_surplus = hqla - (net_cash_outflows * min_lcr)

        return {
            "lcr": lcr,
            "hqla": hqla,
            "net_cash_outflows_30d": net_cash_outflows,
            "lcr_surplus": lcr_surplus,
            "meets_requirement": lcr >= min_lcr,
        }

    def get_required_fields(self) -> list[str]:
        """Return required fields for LCR calculation."""
        return ["high_quality_liquid_assets", "net_cash_outflows_30d"]


class NSFRRule(BaseRegulatoryRule):
    """Net Stable Funding Ratio rule."""

    def __init__(self, jurisdiction: Jurisdiction, **kwargs):
        super().__init__(RegulatoryFramework.NSFR, jurisdiction, **kwargs)

    def _validate_parameters(self) -> None:
        """Validate NSFR parameters."""
        min_nsfr = self.parameters.get("min_nsfr", 1.0)
        if min_nsfr < 0:
            raise ValueError("min_nsfr must be non-negative")

    def calculate(self, portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate NSFR."""
        available_stable_funding = portfolio_data.get("available_stable_funding", 0.0)
        required_stable_funding = portfolio_data.get("required_stable_funding", 0.0)

        nsfr = (
            available_stable_funding / required_stable_funding
            if required_stable_funding > 0
            else float("inf")
        )
        min_nsfr = self.parameters.get("min_nsfr", 1.0)
        nsfr_surplus = available_stable_funding - (required_stable_funding * min_nsfr)

        return {
            "nsfr": nsfr,
            "available_stable_funding": available_stable_funding,
            "required_stable_funding": required_stable_funding,
            "nsfr_surplus": nsfr_surplus,
            "meets_requirement": nsfr >= min_nsfr,
        }

    def get_required_fields(self) -> list[str]:
        """Return required fields for NSFR calculation."""
        return ["available_stable_funding", "required_stable_funding"]


class CECLRule(BaseRegulatoryRule):
    """Current Expected Credit Loss (CECL) rule."""

    def __init__(self, jurisdiction: Jurisdiction, **kwargs):
        super().__init__(RegulatoryFramework.CECL, jurisdiction, **kwargs)

    def _validate_parameters(self) -> None:
        """Validate CECL parameters."""
        pass

    def calculate(self, portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate CECL allowance."""
        # Placeholder implementation
        lifetime_expected_loss = portfolio_data.get("lifetime_expected_loss", 0.0)
        current_allowance = portfolio_data.get("current_allowance", 0.0)

        allowance_change = lifetime_expected_loss - current_allowance

        return {
            "lifetime_expected_loss": lifetime_expected_loss,
            "current_allowance": current_allowance,
            "allowance_change": allowance_change,
            "new_allowance": lifetime_expected_loss,
        }

    def get_required_fields(self) -> list[str]:
        """Return required fields for CECL calculation."""
        return ["lifetime_expected_loss", "current_allowance"]


class IFRS9Rule(BaseRegulatoryRule):
    """IFRS 9 Expected Credit Loss rule."""

    def __init__(self, jurisdiction: Jurisdiction, **kwargs):
        super().__init__(RegulatoryFramework.IFRS_9, jurisdiction, **kwargs)

    def _validate_parameters(self) -> None:
        """Validate IFRS 9 parameters."""
        pass

    def calculate(self, portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate IFRS 9 ECL."""
        # Placeholder implementation
        stage1_ecl = portfolio_data.get("stage1_ecl", 0.0)
        stage2_ecl = portfolio_data.get("stage2_ecl", 0.0)
        stage3_ecl = portfolio_data.get("stage3_ecl", 0.0)

        total_ecl = stage1_ecl + stage2_ecl + stage3_ecl

        return {
            "total_ecl": total_ecl,
            "stage1_ecl": stage1_ecl,
            "stage2_ecl": stage2_ecl,
            "stage3_ecl": stage3_ecl,
        }

    def get_required_fields(self) -> list[str]:
        """Return required fields for IFRS 9 calculation."""
        return ["stage1_ecl", "stage2_ecl", "stage3_ecl"]

