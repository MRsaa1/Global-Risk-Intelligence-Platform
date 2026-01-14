"""
Financial Risk Models - Credit Risk and Valuation.

Models:
- PD (Probability of Default) with climate adjustment
- LGD (Loss Given Default) with physical damage
- Climate-adjusted DCF Valuation
- Expected Loss calculation
"""
import logging
import math
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class RatingGrade(str, Enum):
    """Credit rating grades."""
    AAA = "AAA"
    AA = "AA"
    A = "A"
    BBB = "BBB"
    BB = "BB"
    B = "B"
    CCC = "CCC"
    CC = "CC"
    C = "C"
    D = "D"


@dataclass
class PDModel:
    """Probability of Default model result."""
    base_pd: float  # Base PD from traditional factors
    climate_adjustment: float  # Adjustment from climate risk
    physical_adjustment: float  # Adjustment from physical condition
    network_adjustment: float  # Adjustment from dependency risk
    final_pd: float  # Total PD
    rating: RatingGrade
    confidence: float
    factors: dict


@dataclass
class LGDModel:
    """Loss Given Default model result."""
    base_lgd: float  # Base LGD from collateral value
    damage_adjustment: float  # Adjustment from physical damage scenarios
    market_adjustment: float  # Adjustment from market conditions
    final_lgd: float  # Total LGD
    recovery_rate: float  # 1 - LGD
    factors: dict


@dataclass
class ValuationModel:
    """Climate-adjusted asset valuation."""
    current_value: float
    climate_adjusted_value: float
    value_at_risk: float  # VaR at 95%
    expected_shortfall: float  # ES at 95%
    discount_rate: float
    terminal_value: float
    npv_cashflows: float
    factors: dict


@dataclass
class ExpectedLoss:
    """Expected Loss calculation."""
    pd: float
    lgd: float
    ead: float  # Exposure at Default
    expected_loss: float  # PD × LGD × EAD
    unexpected_loss: float  # For capital calculation
    capital_requirement: float  # Basel-style capital


class FinancialModelService:
    """
    Service for financial risk calculations.
    
    Key innovation: Climate and physical risk adjustments
    integrated directly into PD/LGD models.
    """
    
    # Base PD by rating (annual)
    BASE_PD_BY_RATING = {
        RatingGrade.AAA: 0.0001,
        RatingGrade.AA: 0.0002,
        RatingGrade.A: 0.0005,
        RatingGrade.BBB: 0.0020,
        RatingGrade.BB: 0.0100,
        RatingGrade.B: 0.0400,
        RatingGrade.CCC: 0.1500,
        RatingGrade.CC: 0.3000,
        RatingGrade.C: 0.5000,
        RatingGrade.D: 1.0000,
    }
    
    def calculate_pd(
        self,
        # Traditional factors
        dscr: float,  # Debt Service Coverage Ratio
        ltv: float,  # Loan-to-Value ratio
        occupancy: float,  # Occupancy rate (0-1)
        years_since_renovation: int = 0,
        # Climate risk factors
        climate_risk_score: float = 0,  # 0-100
        # Physical condition factors
        physical_risk_score: float = 0,  # 0-100
        structural_integrity: float = 100,  # 0-100
        # Network risk factors
        network_risk_score: float = 0,  # 0-100
    ) -> PDModel:
        """
        Calculate Probability of Default with integrated risk adjustments.
        
        Innovation: Direct mapping from physical reality to credit risk.
        
        Args:
            dscr: Debt Service Coverage Ratio (higher = better)
            ltv: Loan-to-Value ratio (lower = better)
            occupancy: Property occupancy rate
            years_since_renovation: Years since last major renovation
            climate_risk_score: Climate risk score 0-100
            physical_risk_score: Physical condition risk score 0-100
            structural_integrity: Structural integrity score 0-100
            network_risk_score: Dependency/network risk score 0-100
            
        Returns:
            PDModel with base PD, adjustments, and final PD
        """
        # Step 1: Calculate base PD from traditional factors
        # Using logistic regression-style scoring
        
        # DSCR contribution (higher DSCR = lower risk)
        dscr_score = max(0, min(100, (dscr - 1.0) * 50))
        
        # LTV contribution (lower LTV = lower risk)
        ltv_score = max(0, min(100, (1 - ltv) * 100))
        
        # Occupancy contribution (higher occupancy = lower risk)
        occupancy_score = occupancy * 100
        
        # Age/condition contribution
        age_score = max(0, 100 - years_since_renovation * 2)
        
        # Weighted traditional score (0-100, higher = better)
        traditional_score = (
            dscr_score * 0.35 +
            ltv_score * 0.30 +
            occupancy_score * 0.25 +
            age_score * 0.10
        )
        
        # Convert score to base PD using logistic function
        # Higher score = lower PD
        z = (50 - traditional_score) / 15  # Center at 50, scale
        base_pd = 1 / (1 + math.exp(-z)) * 0.10  # Max 10% base PD
        base_pd = max(0.0001, min(0.10, base_pd))
        
        # Step 2: Calculate risk adjustments
        
        # Climate adjustment (additive, in basis points)
        # 100 climate score = +200 bps PD
        climate_adjustment = (climate_risk_score / 100) * 0.02
        
        # Physical adjustment
        # Low structural integrity increases PD significantly
        physical_adjustment = ((100 - structural_integrity) / 100) * 0.03
        physical_adjustment += (physical_risk_score / 100) * 0.01
        
        # Network adjustment (cascade risk)
        network_adjustment = (network_risk_score / 100) * 0.015
        
        # Step 3: Calculate final PD
        final_pd = base_pd + climate_adjustment + physical_adjustment + network_adjustment
        final_pd = max(0.0001, min(0.9999, final_pd))
        
        # Step 4: Determine rating
        rating = self._pd_to_rating(final_pd)
        
        # Calculate confidence based on data quality
        confidence = 0.85  # Base confidence
        
        return PDModel(
            base_pd=base_pd,
            climate_adjustment=climate_adjustment,
            physical_adjustment=physical_adjustment,
            network_adjustment=network_adjustment,
            final_pd=final_pd,
            rating=rating,
            confidence=confidence,
            factors={
                "dscr_score": dscr_score,
                "ltv_score": ltv_score,
                "occupancy_score": occupancy_score,
                "age_score": age_score,
                "traditional_score": traditional_score,
            },
        )
    
    def calculate_lgd(
        self,
        property_value: float,
        outstanding_debt: float,
        # Physical damage scenarios
        flood_damage_ratio: float = 0,  # 0-1 damage from flood
        structural_damage_ratio: float = 0,  # 0-1 structural damage
        # Market factors
        market_stress_factor: float = 1.0,  # 1.0 = normal, 0.8 = stressed
        liquidation_cost_ratio: float = 0.10,  # 10% typical
        time_to_liquidation_years: float = 2.0,
    ) -> LGDModel:
        """
        Calculate Loss Given Default with physical damage scenarios.
        
        Innovation: LGD directly incorporates physical damage from
        simulated events (floods, structural failures, etc.)
        
        Args:
            property_value: Current market value
            outstanding_debt: Outstanding loan amount
            flood_damage_ratio: Damage ratio from flood simulation
            structural_damage_ratio: Damage ratio from structural analysis
            market_stress_factor: Market value multiplier in stress
            liquidation_cost_ratio: Costs as % of value
            time_to_liquidation_years: Expected liquidation time
            
        Returns:
            LGDModel with base LGD, adjustments, and final LGD
        """
        # Step 1: Calculate base LGD from collateral
        ltv = outstanding_debt / property_value if property_value > 0 else 1.0
        
        # Base recovery = (Value - Costs) / Debt
        liquidation_costs = property_value * liquidation_cost_ratio
        base_recovery = max(0, (property_value - liquidation_costs) / outstanding_debt)
        base_lgd = max(0, min(1, 1 - base_recovery))
        
        # Step 2: Physical damage adjustment
        # Combine damage ratios (not additive, use max + partial overlap)
        total_damage_ratio = max(flood_damage_ratio, structural_damage_ratio)
        overlap = min(flood_damage_ratio, structural_damage_ratio) * 0.3
        total_damage_ratio = min(1.0, total_damage_ratio + overlap)
        
        # Damaged value
        damaged_value = property_value * (1 - total_damage_ratio)
        damage_adjustment = (property_value - damaged_value) / outstanding_debt
        damage_adjustment = min(1.0, max(0, damage_adjustment))
        
        # Step 3: Market adjustment
        stressed_value = damaged_value * market_stress_factor
        market_adjustment = (damaged_value - stressed_value) / outstanding_debt
        market_adjustment = min(1.0, max(0, market_adjustment))
        
        # Step 4: Time value adjustment (holding costs, value decay)
        holding_cost_rate = 0.02  # 2% per year
        time_adjustment = time_to_liquidation_years * holding_cost_rate
        
        # Step 5: Final LGD
        final_lgd = base_lgd + damage_adjustment + market_adjustment + time_adjustment
        final_lgd = max(0, min(1, final_lgd))
        
        recovery_rate = 1 - final_lgd
        
        return LGDModel(
            base_lgd=base_lgd,
            damage_adjustment=damage_adjustment,
            market_adjustment=market_adjustment,
            final_lgd=final_lgd,
            recovery_rate=recovery_rate,
            factors={
                "ltv": ltv,
                "flood_damage_ratio": flood_damage_ratio,
                "structural_damage_ratio": structural_damage_ratio,
                "total_damage_ratio": total_damage_ratio,
                "stressed_value": stressed_value,
                "time_adjustment": time_adjustment,
            },
        )
    
    def calculate_climate_adjusted_dcf(
        self,
        # Cash flow inputs
        annual_noi: float,  # Net Operating Income
        noi_growth_rate: float = 0.02,  # 2% annual growth
        holding_period_years: int = 10,
        # Discount rate components
        risk_free_rate: float = 0.03,  # 3%
        market_risk_premium: float = 0.05,  # 5%
        property_beta: float = 0.8,
        # Climate adjustments
        climate_risk_score: float = 0,  # 0-100
        # Terminal value
        exit_cap_rate: float = 0.05,  # 5%
    ) -> ValuationModel:
        """
        Calculate climate-adjusted DCF valuation.
        
        Innovation: Climate risk increases discount rate and
        reduces terminal value through cap rate adjustment.
        
        Args:
            annual_noi: Current annual Net Operating Income
            noi_growth_rate: Expected annual NOI growth
            holding_period_years: Investment horizon
            risk_free_rate: Risk-free rate
            market_risk_premium: Market risk premium
            property_beta: Property's beta to market
            climate_risk_score: Climate risk score 0-100
            exit_cap_rate: Cap rate for terminal value
            
        Returns:
            ValuationModel with current and climate-adjusted values
        """
        # Step 1: Calculate standard discount rate (CAPM)
        base_discount_rate = risk_free_rate + property_beta * market_risk_premium
        
        # Step 2: Climate risk premium (higher climate risk = higher discount rate)
        # Max 300 bps additional for highest climate risk
        climate_risk_premium = (climate_risk_score / 100) * 0.03
        
        discount_rate = base_discount_rate + climate_risk_premium
        
        # Step 3: Climate-adjusted exit cap rate
        # Higher climate risk = higher cap rate = lower terminal value
        climate_cap_adjustment = (climate_risk_score / 100) * 0.02
        adjusted_exit_cap_rate = exit_cap_rate + climate_cap_adjustment
        
        # Step 4: Calculate NPV of cash flows
        npv_cashflows = 0
        projected_noi = annual_noi
        
        for year in range(1, holding_period_years + 1):
            projected_noi = annual_noi * ((1 + noi_growth_rate) ** year)
            discount_factor = 1 / ((1 + discount_rate) ** year)
            npv_cashflows += projected_noi * discount_factor
        
        # Step 5: Terminal value
        terminal_noi = annual_noi * ((1 + noi_growth_rate) ** holding_period_years)
        terminal_value = terminal_noi / adjusted_exit_cap_rate
        terminal_value_pv = terminal_value / ((1 + discount_rate) ** holding_period_years)
        
        # Step 6: Total value
        climate_adjusted_value = npv_cashflows + terminal_value_pv
        
        # Step 7: Calculate base value (without climate adjustment) for comparison
        base_discount_rate_only = base_discount_rate
        npv_base = 0
        projected_noi = annual_noi
        
        for year in range(1, holding_period_years + 1):
            projected_noi = annual_noi * ((1 + noi_growth_rate) ** year)
            discount_factor = 1 / ((1 + base_discount_rate_only) ** year)
            npv_base += projected_noi * discount_factor
        
        terminal_value_base = (annual_noi * ((1 + noi_growth_rate) ** holding_period_years)) / exit_cap_rate
        terminal_value_base_pv = terminal_value_base / ((1 + base_discount_rate_only) ** holding_period_years)
        current_value = npv_base + terminal_value_base_pv
        
        # Step 8: Value at Risk (simplified Monte Carlo would be used in production)
        # Approximate VaR as % reduction from climate stress
        value_at_risk = climate_adjusted_value * (1 + climate_risk_score / 100 * 0.15)
        expected_shortfall = value_at_risk * 1.25  # Approximate ES
        
        return ValuationModel(
            current_value=current_value,
            climate_adjusted_value=climate_adjusted_value,
            value_at_risk=value_at_risk,
            expected_shortfall=expected_shortfall,
            discount_rate=discount_rate,
            terminal_value=terminal_value_pv,
            npv_cashflows=npv_cashflows,
            factors={
                "base_discount_rate": base_discount_rate,
                "climate_risk_premium": climate_risk_premium,
                "climate_cap_adjustment": climate_cap_adjustment,
                "adjusted_exit_cap_rate": adjusted_exit_cap_rate,
                "value_reduction_percent": (current_value - climate_adjusted_value) / current_value * 100 if current_value > 0 else 0,
            },
        )
    
    def calculate_expected_loss(
        self,
        pd: float,
        lgd: float,
        ead: float,
        maturity_years: float = 1.0,
        correlation: float = 0.15,  # Asset correlation for Basel
    ) -> ExpectedLoss:
        """
        Calculate Expected Loss and capital requirements.
        
        Args:
            pd: Probability of Default
            lgd: Loss Given Default
            ead: Exposure at Default
            maturity_years: Remaining maturity
            correlation: Asset correlation factor
            
        Returns:
            ExpectedLoss with EL, UL, and capital
        """
        # Expected Loss
        expected_loss = pd * lgd * ead
        
        # Unexpected Loss (simplified Basel formula)
        # UL = EAD × LGD × sqrt(PD × (1 - PD))
        pd_volatility = math.sqrt(pd * (1 - pd))
        unexpected_loss = ead * lgd * pd_volatility
        
        # Capital requirement (simplified Basel IRB)
        # Using Vasicek single factor model
        from scipy.stats import norm
        
        # Conditional PD at 99.9% confidence
        z_999 = norm.ppf(0.999)
        z_pd = norm.ppf(pd)
        
        conditional_pd = norm.cdf(
            (z_pd + math.sqrt(correlation) * z_999) / math.sqrt(1 - correlation)
        )
        
        # Capital = EAD × LGD × (Conditional PD - PD) × Maturity Adjustment
        maturity_adjustment = 1 + (maturity_years - 2.5) * 0.05  # Simplified
        maturity_adjustment = max(1.0, min(1.5, maturity_adjustment))
        
        capital_requirement = ead * lgd * (conditional_pd - pd) * maturity_adjustment
        
        return ExpectedLoss(
            pd=pd,
            lgd=lgd,
            ead=ead,
            expected_loss=expected_loss,
            unexpected_loss=unexpected_loss,
            capital_requirement=capital_requirement,
        )
    
    def _pd_to_rating(self, pd: float) -> RatingGrade:
        """Convert PD to rating grade."""
        if pd < 0.0002:
            return RatingGrade.AAA
        elif pd < 0.0005:
            return RatingGrade.AA
        elif pd < 0.001:
            return RatingGrade.A
        elif pd < 0.005:
            return RatingGrade.BBB
        elif pd < 0.02:
            return RatingGrade.BB
        elif pd < 0.06:
            return RatingGrade.B
        elif pd < 0.20:
            return RatingGrade.CCC
        elif pd < 0.40:
            return RatingGrade.CC
        elif pd < 0.80:
            return RatingGrade.C
        else:
            return RatingGrade.D


# Global service instance
financial_model_service = FinancialModelService()
