"""
Sector-Specific Stress Test Calculators
=======================================

Implements sector-specific formulas from Universal Stress Testing Methodology:
- Insurance: Solvency_Ratio, Claims_Coverage, Aggregate_Exposure, VaR
- Real Estate: Cash_Runway, Occupancy_Stress, DSCR, LTV_Stress
- Financial: NPL_Ratio, LCR, CET1_Impact, VaR_Trading
- Enterprise: Cash_Runway, Supply_Buffer, Operations_Rate, Recovery_Time
- Defense: Inventory_Coverage, Readiness_Index, SPOF_Score, Capability_Gap

Reference: Universal Stress Testing Methodology v1.0, Part 1.2
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

import numpy as np
from scipy import stats

logger = logging.getLogger(__name__)


class SectorType(str, Enum):
    """Sector types."""
    INSURANCE = "insurance"
    REAL_ESTATE = "real_estate"
    FINANCIAL = "financial"
    ENTERPRISE = "enterprise"
    DEFENSE = "defense"


# =============================================================================
# INSURANCE SECTOR FORMULAS
# =============================================================================

@dataclass
class InsuranceInputs:
    """Input parameters for insurance sector stress test."""
    available_capital: float  # Available own funds
    scr: float  # Solvency Capital Requirement
    reserves: float  # Technical reserves
    reinsurance_coverage: float  # Reinsurance recoverables
    expected_claims: float  # Expected claims under stress
    policy_limits: List[float]  # Policy limits by line of business
    correlation_factor: float = 0.3  # Cross-LoB correlation
    loss_ratio_base: float = 0.65  # Historical loss ratio
    stress_multiplier: float = 1.5  # Stress scenario multiplier
    confidence_level: float = 0.99  # VaR confidence
    holding_period: int = 1  # Holding period in years


@dataclass
class InsuranceMetrics:
    """Output metrics for insurance sector."""
    solvency_ratio: float  # (Available_Capital - Stressed_Losses) / SCR
    claims_coverage: float  # (Reserves + Reinsurance) / Expected_Claims
    aggregate_exposure: float  # Σ(Policy_Limits) × Correlation_Factor
    var: float  # μ + σ × Z(confidence) × √(holding_period)
    stressed_loss_ratio: float
    net_exposure: float
    capital_surplus_deficit: float


def calculate_insurance_metrics(inputs: InsuranceInputs) -> InsuranceMetrics:
    """
    Calculate insurance sector stress test metrics.
    
    Formulas from methodology:
    - Solvency_Ratio = (Available_Capital - Stressed_Losses) / SCR
    - Claims_Coverage = (Reserves + Reinsurance) / Expected_Claims
    - Aggregate_Exposure = Σ(Policy_Limits) × Correlation_Factor
    - VaR = μ + σ × Z(confidence) × √(holding_period)
    """
    # Stressed loss ratio
    stressed_loss_ratio = inputs.loss_ratio_base * inputs.stress_multiplier
    
    # Expected losses under stress
    total_policy_limits = sum(inputs.policy_limits)
    stressed_losses = total_policy_limits * stressed_loss_ratio * 0.1  # Simplified
    
    # Solvency Ratio
    solvency_ratio = (inputs.available_capital - stressed_losses) / inputs.scr if inputs.scr > 0 else 0
    
    # Claims Coverage
    claims_coverage = (inputs.reserves + inputs.reinsurance_coverage) / inputs.expected_claims if inputs.expected_claims > 0 else 0
    
    # Aggregate Exposure with correlation
    aggregate_exposure = total_policy_limits * inputs.correlation_factor
    
    # VaR calculation: μ + σ × Z(confidence) × √(holding_period)
    mu = inputs.expected_claims
    sigma = inputs.expected_claims * 0.25  # Assumed 25% volatility
    z = stats.norm.ppf(inputs.confidence_level)
    var = mu + sigma * z * np.sqrt(inputs.holding_period)
    
    # Net exposure after reinsurance
    net_exposure = aggregate_exposure - inputs.reinsurance_coverage
    
    # Capital surplus/deficit
    capital_surplus_deficit = inputs.available_capital - stressed_losses - inputs.scr
    
    return InsuranceMetrics(
        solvency_ratio=round(solvency_ratio, 4),
        claims_coverage=round(claims_coverage, 4),
        aggregate_exposure=round(aggregate_exposure, 2),
        var=round(var, 2),
        stressed_loss_ratio=round(stressed_loss_ratio, 4),
        net_exposure=round(net_exposure, 2),
        capital_surplus_deficit=round(capital_surplus_deficit, 2)
    )


# =============================================================================
# REAL ESTATE SECTOR FORMULAS
# =============================================================================

@dataclass
class RealEstateInputs:
    """Input parameters for real estate sector stress test."""
    cash: float  # Cash on hand
    credit_facilities: float  # Available credit lines
    burn_rate: float  # Monthly burn rate
    current_occupancy: float  # Current occupancy rate (0-1)
    demand_shock: float  # Demand reduction under stress (0-1)
    noi_stressed: float  # Net Operating Income under stress
    debt_service: float  # Annual debt service
    debt: float  # Total outstanding debt
    property_value: float  # Current property value
    market_decline: float  # Market value decline under stress (0-1)


@dataclass
class RealEstateMetrics:
    """Output metrics for real estate sector."""
    cash_runway_months: float  # (Cash + Facilities) / Burn_Rate
    occupancy_stress: float  # Current_Occupancy × (1 - Demand_Shock)
    dscr: float  # NOI_Stressed / Debt_Service
    ltv_stress: float  # Debt / (Property_Value × (1 - Market_Decline))
    liquidity_buffer: float
    breakeven_occupancy: float


def calculate_real_estate_metrics(inputs: RealEstateInputs) -> RealEstateMetrics:
    """
    Calculate real estate sector stress test metrics.
    
    Formulas:
    - Cash_Runway = (Cash + Facilities) / Burn_Rate
    - Occupancy_Stress = Current_Occupancy × (1 - Demand_Shock)
    - DSCR = NOI_Stressed / Debt_Service
    - LTV_Stress = Debt / (Property_Value × (1 - Market_Decline))
    """
    # Cash Runway (in months)
    cash_runway = (inputs.cash + inputs.credit_facilities) / inputs.burn_rate if inputs.burn_rate > 0 else 999
    
    # Occupancy under stress
    occupancy_stress = inputs.current_occupancy * (1 - inputs.demand_shock)
    
    # Debt Service Coverage Ratio
    dscr = inputs.noi_stressed / inputs.debt_service if inputs.debt_service > 0 else 0
    
    # Loan-to-Value under stress
    stressed_property_value = inputs.property_value * (1 - inputs.market_decline)
    ltv_stress = inputs.debt / stressed_property_value if stressed_property_value > 0 else 999
    
    # Liquidity buffer in months of debt service
    liquidity_buffer = (inputs.cash + inputs.credit_facilities) / (inputs.debt_service / 12) if inputs.debt_service > 0 else 0
    
    # Breakeven occupancy (occupancy needed to cover debt service)
    revenue_per_occupancy = inputs.noi_stressed / inputs.current_occupancy if inputs.current_occupancy > 0 else 0
    breakeven_occupancy = inputs.debt_service / revenue_per_occupancy if revenue_per_occupancy > 0 else 1
    
    return RealEstateMetrics(
        cash_runway_months=round(cash_runway, 1),
        occupancy_stress=round(occupancy_stress, 4),
        dscr=round(dscr, 4),
        ltv_stress=round(ltv_stress, 4),
        liquidity_buffer=round(liquidity_buffer, 1),
        breakeven_occupancy=round(min(breakeven_occupancy, 1.0), 4)
    )


# =============================================================================
# FINANCIAL INSTITUTIONS SECTOR FORMULAS
# =============================================================================

@dataclass
class FinancialInputs:
    """Input parameters for financial institutions stress test."""
    defaults: float  # Expected defaults under stress
    lgd: float  # Loss Given Default
    total_loans: float  # Total loan book
    hqla: float  # High Quality Liquid Assets
    net_outflows_30d: float  # Net outflows over 30 days
    losses: float  # Expected losses
    rwa: float  # Risk Weighted Assets
    cet1: float  # Current CET1 capital
    positions: List[float]  # Trading positions
    volatilities: List[float]  # Position volatilities
    confidence: float = 0.99
    holding_days: int = 10


@dataclass
class FinancialMetrics:
    """Output metrics for financial institutions."""
    npl_ratio: float  # (Defaults × LGD) / Total_Loans
    lcr: float  # HQLA / Net_Outflows_30d
    cet1_impact_bps: float  # -Losses / RWA (in basis points)
    var_trading: float  # Σ(Position × Volatility × Z × √t)
    capital_buffer: float
    liquidity_gap: float


def calculate_financial_metrics(inputs: FinancialInputs) -> FinancialMetrics:
    """
    Calculate financial institutions stress test metrics.
    
    Formulas:
    - NPL_Ratio = (Defaults × LGD) / Total_Loans
    - LCR = HQLA / Net_Outflows_30d
    - CET1_Impact = -Losses / RWA
    - VaR_Trading = Σ(Position × Volatility × Z × √t)
    """
    # NPL Ratio
    npl_ratio = (inputs.defaults * inputs.lgd) / inputs.total_loans if inputs.total_loans > 0 else 0
    
    # Liquidity Coverage Ratio
    lcr = inputs.hqla / inputs.net_outflows_30d if inputs.net_outflows_30d > 0 else 999
    
    # CET1 Impact (in basis points)
    cet1_impact_bps = -(inputs.losses / inputs.rwa) * 10000 if inputs.rwa > 0 else 0
    
    # Trading VaR
    z = stats.norm.ppf(inputs.confidence)
    t_sqrt = np.sqrt(inputs.holding_days / 252)  # Annualized
    
    if len(inputs.positions) == len(inputs.volatilities):
        position_vars = [
            pos * vol * z * t_sqrt 
            for pos, vol in zip(inputs.positions, inputs.volatilities)
        ]
        var_trading = np.sqrt(sum(v**2 for v in position_vars))  # Assuming no correlation
    else:
        var_trading = 0
    
    # Capital buffer
    capital_buffer = inputs.cet1 - inputs.losses
    
    # Liquidity gap
    liquidity_gap = inputs.hqla - inputs.net_outflows_30d
    
    return FinancialMetrics(
        npl_ratio=round(npl_ratio, 4),
        lcr=round(lcr, 4),
        cet1_impact_bps=round(cet1_impact_bps, 0),
        var_trading=round(var_trading, 2),
        capital_buffer=round(capital_buffer, 2),
        liquidity_gap=round(liquidity_gap, 2)
    )


# =============================================================================
# ENTERPRISE SECTOR FORMULAS
# =============================================================================

@dataclass
class EnterpriseInputs:
    """Input parameters for enterprise sector stress test."""
    cash: float  # Cash on hand
    revenue: float  # Annual revenue
    revenue_decline: float  # Revenue decline under stress (0-1)
    fixed_costs: float  # Annual fixed costs
    inventory_days: float  # Days of inventory
    critical_lead_time: float  # Critical supplier lead time (days)
    available_workforce: float  # Available workforce under stress
    required_workforce: float  # Required workforce for operations
    process_recovery_times: List[float]  # Recovery time per process (days)
    dependencies: List[float] = None  # Dependency delays (days)


@dataclass
class EnterpriseMetrics:
    """Output metrics for enterprise sector."""
    cash_runway_months: float  # Cash / ((Revenue × (1-Decline)) - Fixed_Costs)
    supply_buffer: float  # Inventory_Days / Critical_Lead_Time
    operations_rate: float  # Available_Workforce / Required_Workforce
    recovery_time_days: float  # Σ(Process_Recovery) + Dependencies
    burn_rate_monthly: float
    operational_capacity: float


def calculate_enterprise_metrics(inputs: EnterpriseInputs) -> EnterpriseMetrics:
    """
    Calculate enterprise sector stress test metrics.
    
    Formulas:
    - Cash_Runway = Cash / ((Revenue × (1-Decline)) - Fixed_Costs)
    - Supply_Buffer = Inventory_Days / Critical_Lead_Time
    - Operations_Rate = Available_Workforce / Required_Workforce
    - Recovery_Time = Σ(Process_Recovery) + Dependencies
    """
    # Cash Runway
    stressed_revenue = inputs.revenue * (1 - inputs.revenue_decline)
    monthly_cash_flow = (stressed_revenue - inputs.fixed_costs) / 12
    cash_runway = inputs.cash / abs(monthly_cash_flow) if monthly_cash_flow != 0 else 999
    if monthly_cash_flow < 0:
        cash_runway = inputs.cash / abs(monthly_cash_flow)
    
    # Supply Buffer
    supply_buffer = inputs.inventory_days / inputs.critical_lead_time if inputs.critical_lead_time > 0 else 999
    
    # Operations Rate
    operations_rate = inputs.available_workforce / inputs.required_workforce if inputs.required_workforce > 0 else 0
    
    # Recovery Time
    base_recovery = sum(inputs.process_recovery_times) if inputs.process_recovery_times else 0
    dependency_delay = sum(inputs.dependencies) if inputs.dependencies else 0
    recovery_time = base_recovery + dependency_delay
    
    # Burn rate (monthly)
    burn_rate = abs(monthly_cash_flow) if monthly_cash_flow < 0 else 0
    
    # Operational capacity (0-1)
    operational_capacity = min(operations_rate, supply_buffer, 1.0)
    
    return EnterpriseMetrics(
        cash_runway_months=round(cash_runway, 1),
        supply_buffer=round(supply_buffer, 2),
        operations_rate=round(operations_rate, 4),
        recovery_time_days=round(recovery_time, 1),
        burn_rate_monthly=round(burn_rate, 2),
        operational_capacity=round(operational_capacity, 4)
    )


# =============================================================================
# DEFENSE & SECURITY SECTOR FORMULAS
# =============================================================================

@dataclass
class DefenseInputs:
    """Input parameters for defense sector stress test."""
    strategic_reserves: float  # Strategic material reserves
    consumption_rate: float  # Material consumption rate under stress
    operational_units: int  # Operational/available units
    required_units: int  # Required units for mission
    redundant_paths: int  # Number of redundant supply/capability paths
    total_paths: int  # Total paths
    required_capability: float  # Required capability level
    available_capability: float  # Available capability under stress
    program_values: List[float] = None  # Program budgets
    surge_timeline_days: int = 30  # Time to surge capacity


@dataclass
class DefenseMetrics:
    """Output metrics for defense sector."""
    inventory_coverage_days: float  # Strategic_Reserves / Consumption_Rate
    readiness_index: float  # Operational_Units / Required_Units
    spof_score: float  # 1 - (Redundant_Paths / Total_Paths)
    capability_gap: float  # Required_Capability - Available_After_Stress
    mission_risk_score: float
    surge_capacity_factor: float


def calculate_defense_metrics(inputs: DefenseInputs) -> DefenseMetrics:
    """
    Calculate defense sector stress test metrics.
    
    Formulas:
    - Inventory_Coverage = Strategic_Reserves / Consumption_Rate
    - Readiness_Index = Operational_Units / Required_Units
    - SPOF_Score = 1 - (Redundant_Paths / Total_Paths)
    - Capability_Gap = Required_Capability - Available_After_Stress
    """
    # Inventory Coverage (in days)
    inventory_coverage = inputs.strategic_reserves / inputs.consumption_rate if inputs.consumption_rate > 0 else 999
    
    # Readiness Index
    readiness_index = inputs.operational_units / inputs.required_units if inputs.required_units > 0 else 0
    
    # Single Point of Failure Score
    spof_score = 1 - (inputs.redundant_paths / inputs.total_paths) if inputs.total_paths > 0 else 1
    
    # Capability Gap
    capability_gap = inputs.required_capability - inputs.available_capability
    
    # Mission Risk Score (composite)
    mission_risk_score = (
        (1 - readiness_index) * 0.4 +
        spof_score * 0.3 +
        (capability_gap / inputs.required_capability if inputs.required_capability > 0 else 0) * 0.3
    )
    
    # Surge capacity factor
    surge_capacity_factor = min(inputs.surge_timeline_days / 30, 1.0)  # Normalized to 30 days
    
    return DefenseMetrics(
        inventory_coverage_days=round(inventory_coverage, 1),
        readiness_index=round(readiness_index, 4),
        spof_score=round(spof_score, 4),
        capability_gap=round(capability_gap, 2),
        mission_risk_score=round(mission_risk_score, 4),
        surge_capacity_factor=round(surge_capacity_factor, 4)
    )


# =============================================================================
# UNIVERSAL SECTOR CALCULATOR
# =============================================================================

def calculate_sector_metrics(
    sector: str,
    inputs: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Universal sector calculator that routes to appropriate sector formulas.
    
    Args:
        sector: Sector type string
        inputs: Dictionary of input parameters
    
    Returns:
        Dictionary of calculated metrics
    """
    sector_lower = sector.lower()
    
    try:
        if sector_lower == "insurance":
            ins_inputs = InsuranceInputs(**inputs)
            result = calculate_insurance_metrics(ins_inputs)
            
        elif sector_lower == "real_estate":
            re_inputs = RealEstateInputs(**inputs)
            result = calculate_real_estate_metrics(re_inputs)
            
        elif sector_lower == "financial":
            fin_inputs = FinancialInputs(**inputs)
            result = calculate_financial_metrics(fin_inputs)
            
        elif sector_lower == "enterprise":
            ent_inputs = EnterpriseInputs(**inputs)
            result = calculate_enterprise_metrics(ent_inputs)
            
        elif sector_lower == "defense":
            def_inputs = DefenseInputs(**inputs)
            result = calculate_defense_metrics(def_inputs)
            
        else:
            logger.warning(f"Unknown sector {sector}, using enterprise defaults")
            ent_inputs = EnterpriseInputs(**inputs)
            result = calculate_enterprise_metrics(ent_inputs)
        
        # Convert dataclass to dict
        return {k: v for k, v in result.__dict__.items()}
        
    except Exception as e:
        logger.error(f"Error calculating {sector} metrics: {e}")
        return {"error": str(e)}


def get_sector_default_inputs(sector: str, total_exposure: float) -> Dict[str, Any]:
    """
    Generate default input parameters for a sector based on total exposure.
    
    Useful for quick stress tests when detailed inputs aren't available.
    
    Args:
        sector: Sector type
        total_exposure: Total exposure value
    
    Returns:
        Dictionary of default input parameters
    """
    sector_lower = sector.lower()
    
    if sector_lower == "insurance":
        return {
            "available_capital": total_exposure * 0.15,
            "scr": total_exposure * 0.08,
            "reserves": total_exposure * 0.6,
            "reinsurance_coverage": total_exposure * 0.3,
            "expected_claims": total_exposure * 0.1,
            "policy_limits": [total_exposure * 0.2] * 5,
            "correlation_factor": 0.3,
            "loss_ratio_base": 0.65,
            "stress_multiplier": 1.5,
            "confidence_level": 0.99,
            "holding_period": 1
        }
    
    elif sector_lower == "real_estate":
        return {
            "cash": total_exposure * 0.05,
            "credit_facilities": total_exposure * 0.1,
            "burn_rate": total_exposure * 0.01,
            "current_occupancy": 0.92,
            "demand_shock": 0.15,
            "noi_stressed": total_exposure * 0.05,
            "debt_service": total_exposure * 0.06,
            "debt": total_exposure * 0.65,
            "property_value": total_exposure,
            "market_decline": 0.18
        }
    
    elif sector_lower == "financial":
        return {
            "defaults": total_exposure * 0.03,
            "lgd": 0.45,
            "total_loans": total_exposure,
            "hqla": total_exposure * 0.15,
            "net_outflows_30d": total_exposure * 0.1,
            "losses": total_exposure * 0.02,
            "rwa": total_exposure * 0.8,
            "cet1": total_exposure * 0.12,
            "positions": [total_exposure * 0.05] * 5,
            "volatilities": [0.15] * 5,
            "confidence": 0.99,
            "holding_days": 10
        }
    
    elif sector_lower == "enterprise":
        return {
            "cash": total_exposure * 0.1,
            "revenue": total_exposure * 0.3,
            "revenue_decline": 0.25,
            "fixed_costs": total_exposure * 0.15,
            "inventory_days": 45,
            "critical_lead_time": 30,
            "available_workforce": 0.85,
            "required_workforce": 1.0,
            "process_recovery_times": [7, 14, 21],
            "dependencies": [3, 5]
        }
    
    elif sector_lower == "defense":
        return {
            "strategic_reserves": 180,  # days
            "consumption_rate": 2,  # units per day
            "operational_units": 85,
            "required_units": 100,
            "redundant_paths": 2,
            "total_paths": 5,
            "required_capability": 100,
            "available_capability": 75,
            "program_values": [total_exposure * 0.2] * 5,
            "surge_timeline_days": 45
        }
    
    else:
        # Default to enterprise
        return get_sector_default_inputs("enterprise", total_exposure)
