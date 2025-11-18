"""
CCAR/DFAST Stress Testing Framework

Comprehensive Capital Analysis and Review (CCAR) and
Dodd-Frank Act Stress Testing (DFAST) implementation.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from enum import Enum
import structlog
import pandas as pd
import numpy as np

logger = structlog.get_logger(__name__)


class CCARScenarioType(Enum):
    """CCAR scenario types."""
    BASELINE = "baseline"
    ADVERSE = "adverse"
    SEVERELY_ADVERSE = "severely_adverse"


class CCARStressTest:
    """
    CCAR/DFAST Stress Testing Engine.
    
    Implements 9-quarter projection framework for regulatory stress testing.
    """

    def __init__(self, scenario_type: CCARScenarioType = CCARScenarioType.SEVERELY_ADVERSE):
        """
        Initialize CCAR stress test.

        Args:
            scenario_type: Type of CCAR scenario (baseline, adverse, severely_adverse)
        """
        self.scenario_type = scenario_type
        self.projection_quarters = 9
        self.macro_variables = self._load_fed_scenarios()

    def _load_fed_scenarios(self) -> Dict[str, pd.DataFrame]:
        """
        Load Fed-provided scenarios.

        Returns:
            Dictionary of macro variables by scenario type
        """
        # In production, would load from Fed XML/JSON files
        # For now, return placeholder structure
        scenarios = {
            "baseline": self._generate_placeholder_scenario("baseline"),
            "adverse": self._generate_placeholder_scenario("adverse"),
            "severely_adverse": self._generate_placeholder_scenario("severely_adverse"),
        }
        return scenarios

    def _generate_placeholder_scenario(self, scenario_name: str) -> pd.DataFrame:
        """Generate placeholder scenario data."""
        quarters = pd.date_range(
            start=datetime.now(),
            periods=self.projection_quarters,
            freq="Q"
        )
        
        # Placeholder macro variables
        data = {
            "quarter": quarters,
            "gdp_growth": np.random.uniform(-0.5, 0.5, self.projection_quarters),
            "unemployment_rate": np.random.uniform(3.0, 10.0, self.projection_quarters),
            "cpi_inflation": np.random.uniform(0.0, 5.0, self.projection_quarters),
            "treasury_3m": np.random.uniform(0.0, 5.0, self.projection_quarters),
            "treasury_10y": np.random.uniform(1.0, 6.0, self.projection_quarters),
            "house_price_index": np.random.uniform(-10.0, 5.0, self.projection_quarters),
            "commercial_real_estate": np.random.uniform(-15.0, 0.0, self.projection_quarters),
        }
        
        return pd.DataFrame(data)

    def project_balance_sheet(
        self,
        portfolio_id: str,
        initial_balance: Dict[str, float],
        behavioral_models: Dict[str, Any],
    ) -> pd.DataFrame:
        """
        Project balance sheet for 9 quarters.

        Args:
            portfolio_id: Portfolio identifier
            initial_balance: Initial balance sheet positions
            behavioral_models: Behavioral models (prepayment, utilization, etc.)

        Returns:
            DataFrame with projected balance sheet for each quarter
        """
        logger.info(
            "Projecting balance sheet",
            portfolio_id=portfolio_id,
            scenario_type=self.scenario_type.value,
        )

        projections = []
        current_balance = initial_balance.copy()
        macro = self.macro_variables[self.scenario_type.value]

        for quarter_idx in range(self.projection_quarters):
            quarter_data = macro.iloc[quarter_idx]
            
            # Apply behavioral models
            projected_balance = self._apply_behavioral_models(
                current_balance,
                quarter_data,
                behavioral_models,
            )

            # Apply market shocks
            projected_balance = self._apply_market_shocks(
                projected_balance,
                quarter_data,
            )

            # Calculate P&L impact
            pnl = self._calculate_pnl_impact(projected_balance, current_balance)

            projection = {
                "quarter": quarter_data["quarter"],
                "quarter_number": quarter_idx + 1,
                "balance": projected_balance.copy(),
                "pnl": pnl,
                "macro_variables": quarter_data.to_dict(),
            }
            projections.append(projection)

            # Update for next quarter
            current_balance = projected_balance

        return pd.DataFrame(projections)

    def _apply_behavioral_models(
        self,
        balance: Dict[str, float],
        macro: pd.Series,
        models: Dict[str, Any],
    ) -> Dict[str, float]:
        """Apply behavioral models (prepayment, utilization, etc.)."""
        projected = balance.copy()

        # Prepayment model
        if "prepayment" in models:
            prepayment_rate = models["prepayment"].predict(macro)
            projected["loans"] *= (1 - prepayment_rate)

        # Utilization model
        if "utilization" in models:
            utilization_rate = models["utilization"].predict(macro)
            projected["credit_lines"] *= utilization_rate

        # Deposit growth model
        if "deposit_growth" in models:
            growth_rate = models["deposit_growth"].predict(macro)
            projected["deposits"] *= (1 + growth_rate)

        return projected

    def _apply_market_shocks(
        self,
        balance: Dict[str, float],
        macro: pd.Series,
    ) -> Dict[str, float]:
        """Apply market shocks to balance sheet."""
        shocked = balance.copy()

        # Interest rate impact
        rate_shock = macro["treasury_10y"] - macro["treasury_3m"]
        # Apply duration-based impact
        if "securities" in shocked:
            shocked["securities"] *= (1 - 0.05 * rate_shock)  # Simplified

        # House price impact
        if "mortgages" in shocked:
            house_price_shock = macro["house_price_index"] / 100
            shocked["mortgages"] *= (1 + house_price_shock)

        return shocked

    def _calculate_pnl_impact(
        self,
        projected: Dict[str, float],
        current: Dict[str, float],
    ) -> Dict[str, float]:
        """Calculate P&L impact."""
        pnl = {}
        
        # Net interest income
        if "loans" in projected and "deposits" in projected:
            pnl["net_interest_income"] = (
                projected.get("loans", 0) * 0.04 -  # Simplified
                projected.get("deposits", 0) * 0.01
            )

        # Credit losses
        if "loans" in projected:
            pnl["provision_for_loan_losses"] = (
                projected.get("loans", 0) * 0.02  # Simplified
            )

        # Trading income
        if "securities" in projected:
            pnl["trading_income"] = (
                projected.get("securities", 0) - current.get("securities", 0)
            ) * 0.1  # Simplified

        pnl["total_pnl"] = sum(pnl.values())
        return pnl

    def project_capital(
        self,
        initial_capital: float,
        pnl_projections: pd.DataFrame,
        dividend_policy: Dict[str, float],
        share_repurchases: Dict[str, float],
    ) -> pd.DataFrame:
        """
        Project capital over 9 quarters.

        Args:
            initial_capital: Initial capital level
            pnl_projections: P&L projections by quarter
            dividend_policy: Dividend policy (quarterly amounts)
            share_repurchases: Share repurchase policy

        Returns:
            DataFrame with capital projections
        """
        capital_projections = []
        current_capital = initial_capital

        for quarter_idx in range(self.projection_quarters):
            quarter_pnl = pnl_projections.iloc[quarter_idx]["pnl"]["total_pnl"]
            
            # Calculate capital changes
            dividends = dividend_policy.get(f"Q{quarter_idx + 1}", 0)
            repurchases = share_repurchases.get(f"Q{quarter_idx + 1}", 0)
            
            new_capital = (
                current_capital
                + quarter_pnl
                - dividends
                - repurchases
            )

            projection = {
                "quarter": quarter_idx + 1,
                "starting_capital": current_capital,
                "pnl": quarter_pnl,
                "dividends": dividends,
                "share_repurchases": repurchases,
                "ending_capital": new_capital,
                "capital_ratio": new_capital / pnl_projections.iloc[quarter_idx]["balance"].get("total_assets", 1),
            }
            capital_projections.append(projection)

            current_capital = new_capital

        return pd.DataFrame(capital_projections)

    def generate_regulatory_submission(
        self,
        balance_sheet_projections: pd.DataFrame,
        capital_projections: pd.DataFrame,
        format_type: str = "FR_Y_14A",
    ) -> Dict[str, Any]:
        """
        Generate regulatory submission (FR Y-14A/Q/M).

        Args:
            balance_sheet_projections: Balance sheet projections
            capital_projections: Capital projections
            format_type: Submission format type

        Returns:
            Formatted submission data
        """
        logger.info("Generating regulatory submission", format_type=format_type)

        submission = {
            "submission_type": format_type,
            "scenario_type": self.scenario_type.value,
            "as_of_date": datetime.now().isoformat(),
            "balance_sheet": balance_sheet_projections.to_dict("records"),
            "capital": capital_projections.to_dict("records"),
            "summary": {
                "min_capital_ratio": capital_projections["capital_ratio"].min(),
                "final_capital_ratio": capital_projections["capital_ratio"].iloc[-1],
                "total_pnl": capital_projections["pnl"].sum(),
                "total_dividends": capital_projections["dividends"].sum(),
                "total_repurchases": capital_projections["share_repurchases"].sum(),
            },
        }

        return submission

    def validate_submission(self, submission: Dict[str, Any]) -> List[str]:
        """
        Validate submission against Fed requirements.

        Args:
            submission: Submission data

        Returns:
            List of validation errors (empty if valid)
        """
        errors = []

        # Check required fields
        required_fields = ["submission_type", "scenario_type", "balance_sheet", "capital"]
        for field in required_fields:
            if field not in submission:
                errors.append(f"Missing required field: {field}")

        # Check capital ratio
        if "summary" in submission:
            min_ratio = submission["summary"].get("min_capital_ratio", 1.0)
            if min_ratio < 0.045:  # Minimum CET1 ratio
                errors.append(f"Capital ratio below minimum: {min_ratio:.2%}")

        # Check data completeness
        if "balance_sheet" in submission:
            if len(submission["balance_sheet"]) != self.projection_quarters:
                errors.append(
                    f"Incorrect number of quarters: {len(submission['balance_sheet'])}"
                )

        return errors

