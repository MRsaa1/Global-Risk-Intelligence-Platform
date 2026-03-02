"""REIT Metrics Service - NAV, FFO, Yield calculations."""
import logging
from dataclasses import dataclass
from datetime import date
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class REITMetrics:
    """REIT metrics calculation result. Income-related fields are None when no NOI data."""
    portfolio_id: str
    portfolio_name: str
    as_of_date: date

    # Core metrics
    nav: float
    nav_per_share: Optional[float]
    ffo: Optional[float]
    affo: Optional[float]

    # Yield (None when no income data)
    dividend_yield: Optional[float]
    earnings_yield: Optional[float]

    # Leverage
    debt_to_equity: float
    loan_to_value: float
    interest_coverage: Optional[float]

    # Operational (noi/cap_rate None when no annual_noi)
    occupancy: float
    noi: Optional[float]
    cap_rate: Optional[float]

    # Performance
    ytd_return: float
    total_return_1y: Optional[float]

    # Portfolio stats
    asset_count: int
    total_gfa_m2: float

    # Risk
    var_95: float
    climate_risk_score: float

    # Breakdown
    sector_allocation: dict
    geographic_allocation: dict


class REITMetricsService:
    """
    Service for calculating REIT and fund metrics.
    
    Features:
    - NAV calculation
    - FFO/AFFO calculation
    - Yield metrics
    - Risk analytics
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def calculate_metrics(
        self,
        portfolio_id: str,
        shares_outstanding: Optional[float] = None,
    ) -> REITMetrics:
        """
        Calculate comprehensive REIT metrics for a portfolio.
        
        Args:
            portfolio_id: Portfolio ID
            shares_outstanding: Number of shares (for per-share metrics)
            
        Returns:
            REITMetrics with all calculations
        """
        from src.models.portfolio import Portfolio, PortfolioAsset
        from src.models.asset import Asset
        
        # Get portfolio
        result = await self.db.execute(
            select(Portfolio).where(Portfolio.id == portfolio_id)
        )
        portfolio = result.scalar_one_or_none()
        
        if not portfolio:
            raise ValueError(f"Portfolio not found: {portfolio_id}")
        
        # Get portfolio assets with asset details
        assets_result = await self.db.execute(
            select(PortfolioAsset, Asset)
            .join(Asset, PortfolioAsset.asset_id == Asset.id)
            .where(PortfolioAsset.portfolio_id == portfolio_id)
        )
        portfolio_assets = list(assets_result.fetchall())
        
        # Calculate NAV (sum of asset values * ownership)
        nav = sum(
            (pa.current_value or a.current_valuation or 0) * (pa.share_pct / 100)
            for pa, a in portfolio_assets
        )
        
        # Calculate NOI (None when no annual_noi data on any asset)
        noi_raw = sum(
            (pa.annual_noi or 0) * (pa.share_pct / 100)
            for pa, a in portfolio_assets
        )
        has_noi_data = any(pa.annual_noi is not None for pa, a in portfolio_assets)
        noi = noi_raw if has_noi_data else None

        # FFO / AFFO / yields / interest coverage / cap_rate: only when we have income data
        if noi is not None and noi > 0:
            ffo = noi * 0.7
            affo = ffo - (noi * 0.05)
        else:
            ffo = None
            affo = None

        # Calculate debt
        total_debt = portfolio.total_debt or nav * 0.4  # Assume 40% leverage
        total_equity = nav - total_debt

        # Leverage metrics
        debt_to_equity = total_debt / total_equity if total_equity > 0 else 0
        loan_to_value = total_debt / nav if nav > 0 else 0

        # Interest coverage (None when no NOI)
        annual_interest = total_debt * 0.04
        interest_coverage = (noi / annual_interest) if (annual_interest > 0 and noi is not None) else None

        # Occupancy (weighted average)
        total_weight = sum(
            (pa.current_value or 0) for pa, a in portfolio_assets
        )
        occupancy = sum(
            (pa.occupancy or 0.95) * (pa.current_value or 0)
            for pa, a in portfolio_assets
        ) / total_weight if total_weight > 0 else 0.95

        # Cap rate (None when no NOI data)
        cap_rate = (noi / nav) if (nav > 0 and noi is not None) else None

        # Yield (None when no income data)
        if nav > 0 and ffo is not None and affo is not None:
            dividend_yield = (affo * 0.9) / nav
            earnings_yield = ffo / nav
        else:
            dividend_yield = None
            earnings_yield = None
        
        # Per share metrics
        nav_per_share = nav / shares_outstanding if shares_outstanding else None
        
        # Asset count and GFA
        asset_count = len(portfolio_assets)
        total_gfa = sum(
            (a.gross_floor_area_m2 or 0) * (pa.share_pct / 100)
            for pa, a in portfolio_assets
        )
        
        # Risk metrics
        climate_risk = sum(
            (a.climate_risk_score or 30) * (pa.current_value or 0)
            for pa, a in portfolio_assets
        ) / total_weight if total_weight > 0 else 30
        
        # VaR (simplified: 5% of NAV at 95% confidence)
        var_95 = nav * 0.05
        
        # Allocations
        sector_allocation = {}
        geographic_allocation = {}
        
        for pa, a in portfolio_assets:
            value = (pa.current_value or 0) * (pa.share_pct / 100)
            
            # Sector
            sector = a.asset_type or "other"
            sector_allocation[sector] = sector_allocation.get(sector, 0) + value
            
            # Geographic
            country = a.country_code or "XX"
            geographic_allocation[country] = geographic_allocation.get(country, 0) + value
        
        # Convert to percentages
        if nav > 0:
            sector_allocation = {k: v / nav * 100 for k, v in sector_allocation.items()}
            geographic_allocation = {k: v / nav * 100 for k, v in geographic_allocation.items()}
        
        return REITMetrics(
            portfolio_id=portfolio_id,
            portfolio_name=portfolio.name,
            as_of_date=date.today(),
            nav=nav,
            nav_per_share=nav_per_share,
            ffo=ffo,
            affo=affo,
            dividend_yield=dividend_yield,
            earnings_yield=earnings_yield,
            debt_to_equity=debt_to_equity,
            loan_to_value=loan_to_value,
            interest_coverage=interest_coverage,
            occupancy=occupancy,
            noi=noi,
            cap_rate=cap_rate,
            ytd_return=portfolio.ytd_return or 0.05,
            total_return_1y=None,
            asset_count=asset_count,
            total_gfa_m2=total_gfa,
            var_95=var_95,
            climate_risk_score=climate_risk,
            sector_allocation=sector_allocation,
            geographic_allocation=geographic_allocation,
        )
    
    async def calculate_nav(self, portfolio_id: str) -> float:
        """Calculate portfolio NAV."""
        metrics = await self.calculate_metrics(portfolio_id)
        return metrics.nav
    
    async def calculate_ffo(self, portfolio_id: str) -> float:
        """Calculate portfolio FFO."""
        metrics = await self.calculate_metrics(portfolio_id)
        return metrics.ffo
    
    async def calculate_yield(self, portfolio_id: str) -> float:
        """Calculate dividend yield."""
        metrics = await self.calculate_metrics(portfolio_id)
        return metrics.dividend_yield
    
    async def calculate_debt_equity(self, portfolio_id: str) -> float:
        """Calculate debt-to-equity ratio."""
        metrics = await self.calculate_metrics(portfolio_id)
        return metrics.debt_to_equity
