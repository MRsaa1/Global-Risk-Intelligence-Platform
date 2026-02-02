"""Project Finance Service - IRR, NPV, and cashflow analysis."""
import json
import logging
from dataclasses import dataclass
from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class ProjectFinancials:
    """Project financial analysis result."""
    project_id: str
    project_name: str
    currency: str
    
    # Key metrics
    irr: float
    npv: float
    payback_period_years: float
    
    # Cash flows
    total_capex: float
    annual_opex: float
    annual_revenue: float
    annual_net_cashflow: float
    
    # Analysis parameters
    discount_rate: float
    analysis_period_years: int
    
    # Sensitivity
    irr_sensitivity: dict
    npv_sensitivity: dict
    
    # Breakeven
    breakeven_year: Optional[int]
    
    # Risk-adjusted metrics
    risk_adjusted_npv: Optional[float]
    probability_weighted_irr: Optional[float]


@dataclass
class ProjectCashFlow:
    """Single period cash flow."""
    year: int
    capex: float
    opex: float
    revenue: float
    net_cashflow: float
    cumulative_cashflow: float
    discounted_cashflow: float


class ProjectFinanceService:
    """
    Service for project finance calculations.
    
    Features:
    - IRR/NPV calculation
    - Cash flow projections
    - Sensitivity analysis
    - Scenario modeling
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def calculate_irr_npv(
        self,
        project_id: str,
        discount_rate: float = 0.08,
        analysis_period_years: int = 20,
        scenario: Optional[str] = None,
    ) -> ProjectFinancials:
        """
        Calculate IRR and NPV for a project.
        
        Args:
            project_id: Project ID
            discount_rate: Discount rate for NPV
            analysis_period_years: Analysis horizon
            scenario: Optional scenario (low_availability, high_cost, etc.)
            
        Returns:
            ProjectFinancials with IRR, NPV, and analysis
        """
        from src.models.project import Project, ProjectPhase
        
        # Get project
        result = await self.db.execute(
            select(Project).where(Project.id == project_id)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            raise ValueError(f"Project not found: {project_id}")
        
        # Get phases
        phases_result = await self.db.execute(
            select(ProjectPhase)
            .where(ProjectPhase.project_id == project_id)
            .order_by(ProjectPhase.sequence_number)
        )
        phases = list(phases_result.scalars().all())
        
        # Calculate total CAPEX from phases or use project total
        total_capex = project.total_capex_planned or sum(
            (p.capex_planned or 0) for p in phases
        ) or 10_000_000
        
        annual_opex = project.annual_opex_planned or total_capex * 0.02
        annual_revenue = project.annual_revenue_projected or total_capex * 0.12
        
        # Apply scenario adjustments
        if scenario == "low_availability":
            annual_revenue *= 0.85
        elif scenario == "high_cost":
            annual_opex *= 1.25
        elif scenario == "delayed_construction":
            total_capex *= 1.15
        
        # Build cash flows
        cash_flows = []
        cumulative = -total_capex
        
        # Year 0: Initial investment
        cash_flows.append(-total_capex)
        
        # Operating years
        for year in range(1, analysis_period_years + 1):
            net_cf = annual_revenue - annual_opex
            cumulative += net_cf
            cash_flows.append(net_cf)
        
        # Calculate IRR
        irr = self._calculate_irr(cash_flows)
        
        # Calculate NPV
        npv = self._calculate_npv(cash_flows, discount_rate)
        
        # Calculate payback period
        payback = self._calculate_payback(cash_flows)
        
        # Calculate sensitivity
        irr_sensitivity = {
            "revenue_-10%": self._calculate_irr(self._adjust_cashflows(cash_flows, revenue_mult=0.9)),
            "revenue_+10%": self._calculate_irr(self._adjust_cashflows(cash_flows, revenue_mult=1.1)),
            "opex_+20%": self._calculate_irr(self._adjust_cashflows(cash_flows, opex_mult=1.2)),
            "capex_+15%": self._calculate_irr(self._adjust_cashflows(cash_flows, capex_mult=1.15)),
        }
        
        npv_sensitivity = {
            "discount_6%": self._calculate_npv(cash_flows, 0.06),
            "discount_10%": self._calculate_npv(cash_flows, 0.10),
            "discount_12%": self._calculate_npv(cash_flows, 0.12),
        }
        
        # Breakeven year
        breakeven_year = None
        cumulative = cash_flows[0]
        for i, cf in enumerate(cash_flows[1:], 1):
            cumulative += cf
            if cumulative >= 0 and breakeven_year is None:
                breakeven_year = i
                break
        
        return ProjectFinancials(
            project_id=project_id,
            project_name=project.name,
            currency=project.currency,
            irr=irr,
            npv=npv,
            payback_period_years=payback,
            total_capex=total_capex,
            annual_opex=annual_opex,
            annual_revenue=annual_revenue,
            annual_net_cashflow=annual_revenue - annual_opex,
            discount_rate=discount_rate,
            analysis_period_years=analysis_period_years,
            irr_sensitivity=irr_sensitivity,
            npv_sensitivity=npv_sensitivity,
            breakeven_year=breakeven_year,
            risk_adjusted_npv=npv * 0.85,  # Simple risk adjustment
            probability_weighted_irr=irr * 0.9,
        )
    
    def _calculate_irr(self, cash_flows: list[float], guess: float = 0.1) -> float:
        """Calculate IRR using Newton's method."""
        if not cash_flows or all(cf == 0 for cf in cash_flows):
            return 0.0
        
        rate = guess
        for _ in range(100):
            npv = sum(cf / ((1 + rate) ** i) for i, cf in enumerate(cash_flows))
            npv_prime = sum(-i * cf / ((1 + rate) ** (i + 1)) for i, cf in enumerate(cash_flows))
            
            if abs(npv_prime) < 1e-10:
                break
            
            new_rate = rate - npv / npv_prime
            
            if abs(new_rate - rate) < 1e-6:
                return new_rate
            
            rate = new_rate
        
        return rate
    
    def _calculate_npv(self, cash_flows: list[float], discount_rate: float) -> float:
        """Calculate NPV."""
        return sum(cf / ((1 + discount_rate) ** i) for i, cf in enumerate(cash_flows))
    
    def _calculate_payback(self, cash_flows: list[float]) -> float:
        """Calculate simple payback period."""
        if not cash_flows:
            return 0.0
        
        cumulative = 0
        for i, cf in enumerate(cash_flows):
            cumulative += cf
            if cumulative >= 0:
                # Interpolate within the year
                if i > 0 and cash_flows[i] != 0:
                    prev_cum = cumulative - cf
                    fraction = -prev_cum / cf
                    return i - 1 + fraction
                return float(i)
        
        return float(len(cash_flows))
    
    def _adjust_cashflows(
        self,
        cash_flows: list[float],
        revenue_mult: float = 1.0,
        opex_mult: float = 1.0,
        capex_mult: float = 1.0,
    ) -> list[float]:
        """Adjust cash flows for sensitivity analysis."""
        if not cash_flows:
            return []
        
        adjusted = [cash_flows[0] * capex_mult]  # Adjust CAPEX (negative)
        
        for cf in cash_flows[1:]:
            # Simplified: assume CF = Revenue - OPEX
            # This is approximate for sensitivity purposes
            adjusted.append(cf * revenue_mult / opex_mult)
        
        return adjusted
    
    async def get_cash_flow_projection(
        self,
        project_id: str,
        years: int = 20,
        discount_rate: float = 0.08,
    ) -> list[ProjectCashFlow]:
        """Get detailed cash flow projection."""
        from src.models.project import Project
        
        result = await self.db.execute(
            select(Project).where(Project.id == project_id)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            raise ValueError(f"Project not found: {project_id}")
        
        total_capex = project.total_capex_planned or 10_000_000
        annual_opex = project.annual_opex_planned or total_capex * 0.02
        annual_revenue = project.annual_revenue_projected or total_capex * 0.12
        
        cash_flows = []
        cumulative = 0
        
        for year in range(years + 1):
            if year == 0:
                capex = total_capex
                opex = 0
                revenue = 0
            else:
                capex = 0
                opex = annual_opex
                revenue = annual_revenue
            
            net = revenue - opex - capex
            cumulative += net
            discounted = net / ((1 + discount_rate) ** year)
            
            cash_flows.append(ProjectCashFlow(
                year=year,
                capex=capex,
                opex=opex,
                revenue=revenue,
                net_cashflow=net,
                cumulative_cashflow=cumulative,
                discounted_cashflow=discounted,
            ))
        
        return cash_flows
