"""Portfolio and REIT API endpoints."""
import json
from datetime import date, datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.portfolio import Portfolio, PortfolioAsset, PortfolioType
from src.services.reit_metrics import REITMetricsService

router = APIRouter()


# ==================== Schemas ====================

class PortfolioCreate(BaseModel):
    """Create portfolio request."""
    name: str
    description: Optional[str] = None
    code: Optional[str] = None
    portfolio_type: str = Field(default="custom")
    base_currency: str = Field(default="EUR")
    manager_name: Optional[str] = None
    benchmark_index: Optional[str] = None


class PortfolioUpdate(BaseModel):
    """Update portfolio request."""
    name: Optional[str] = None
    description: Optional[str] = None
    portfolio_type: Optional[str] = None
    manager_name: Optional[str] = None
    total_debt: Optional[float] = None
    benchmark_index: Optional[str] = None


class PortfolioResponse(BaseModel):
    """Portfolio response."""
    id: str
    name: str
    description: Optional[str]
    code: Optional[str]
    portfolio_type: str
    base_currency: str
    manager_name: Optional[str]
    nav: Optional[float]
    ffo: Optional[float]
    yield_pct: Optional[float]
    debt_to_equity: Optional[float]
    occupancy: Optional[float]
    asset_count: int
    total_gfa_m2: Optional[float]
    climate_risk_score: Optional[float]
    ytd_return: Optional[float]
    created_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class PortfolioAssetCreate(BaseModel):
    """Add asset to portfolio request."""
    asset_id: str
    share_pct: float = Field(default=100.0, ge=0, le=100)
    acquisition_date: Optional[date] = None
    acquisition_price: Optional[float] = None
    target_irr: Optional[float] = None
    investment_strategy: Optional[str] = None


class PortfolioAssetResponse(BaseModel):
    """Portfolio asset response."""
    id: str
    portfolio_id: str
    asset_id: str
    share_pct: float
    acquisition_date: Optional[date]
    acquisition_price: Optional[float]
    current_value: Optional[float]
    target_irr: Optional[float]
    actual_irr: Optional[float]
    unrealized_gain_loss: Optional[float]
    weight_pct: Optional[float]
    investment_strategy: Optional[str]
    
    class Config:
        from_attributes = True


class REITMetricsResponse(BaseModel):
    """REIT metrics response."""
    portfolio_id: str
    portfolio_name: str
    as_of_date: date
    nav: float
    nav_per_share: Optional[float]
    ffo: float
    affo: float
    dividend_yield: float
    earnings_yield: float
    debt_to_equity: float
    loan_to_value: float
    interest_coverage: float
    occupancy: float
    noi: float
    cap_rate: float
    ytd_return: float
    asset_count: int
    total_gfa_m2: float
    var_95: float
    climate_risk_score: float
    sector_allocation: dict
    geographic_allocation: dict


# ==================== Portfolio CRUD ====================

@router.get("", response_model=list[PortfolioResponse])
async def list_portfolios(
    portfolio_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List all portfolios."""
    query = select(Portfolio).order_by(Portfolio.created_at.desc())
    
    if portfolio_type:
        query = query.where(Portfolio.portfolio_type == portfolio_type)
    
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("", response_model=PortfolioResponse)
async def create_portfolio(
    data: PortfolioCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new portfolio."""
    portfolio = Portfolio(
        id=str(uuid4()),
        name=data.name,
        description=data.description,
        code=data.code or f"PF-{str(uuid4())[:8].upper()}",
        portfolio_type=data.portfolio_type,
        base_currency=data.base_currency,
        manager_name=data.manager_name,
        benchmark_index=data.benchmark_index,
        created_at=datetime.utcnow(),
    )
    
    db.add(portfolio)
    await db.commit()
    await db.refresh(portfolio)
    
    return portfolio


@router.get("/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio(
    portfolio_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get portfolio by ID."""
    result = await db.execute(
        select(Portfolio).where(Portfolio.id == portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    return portfolio


@router.patch("/{portfolio_id}", response_model=PortfolioResponse)
async def update_portfolio(
    portfolio_id: str,
    data: PortfolioUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update portfolio."""
    result = await db.execute(
        select(Portfolio).where(Portfolio.id == portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(portfolio, key, value)
    
    portfolio.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(portfolio)
    
    return portfolio


@router.delete("/{portfolio_id}")
async def delete_portfolio(
    portfolio_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete portfolio."""
    result = await db.execute(
        select(Portfolio).where(Portfolio.id == portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    await db.delete(portfolio)
    await db.commit()
    
    return {"status": "deleted", "id": portfolio_id}


# ==================== Portfolio Assets ====================

@router.get("/{portfolio_id}/assets", response_model=list[PortfolioAssetResponse])
async def list_portfolio_assets(
    portfolio_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List all assets in a portfolio."""
    result = await db.execute(
        select(PortfolioAsset)
        .where(PortfolioAsset.portfolio_id == portfolio_id)
    )
    return list(result.scalars().all())


@router.post("/{portfolio_id}/assets", response_model=PortfolioAssetResponse)
async def add_portfolio_asset(
    portfolio_id: str,
    data: PortfolioAssetCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add an asset to a portfolio."""
    # Verify portfolio exists
    result = await db.execute(
        select(Portfolio).where(Portfolio.id == portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Get asset valuation
    from src.models.asset import Asset
    asset_result = await db.execute(
        select(Asset).where(Asset.id == data.asset_id)
    )
    asset = asset_result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    portfolio_asset = PortfolioAsset(
        id=str(uuid4()),
        portfolio_id=portfolio_id,
        asset_id=data.asset_id,
        share_pct=data.share_pct,
        acquisition_date=data.acquisition_date,
        acquisition_price=data.acquisition_price,
        current_value=asset.current_valuation,
        target_irr=data.target_irr,
        investment_strategy=data.investment_strategy,
        created_at=datetime.utcnow(),
    )
    
    db.add(portfolio_asset)
    
    # Update portfolio asset count
    portfolio.asset_count = (portfolio.asset_count or 0) + 1
    
    await db.commit()
    await db.refresh(portfolio_asset)
    
    return portfolio_asset


@router.delete("/{portfolio_id}/assets/{asset_id}")
async def remove_portfolio_asset(
    portfolio_id: str,
    asset_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Remove an asset from a portfolio."""
    result = await db.execute(
        select(PortfolioAsset)
        .where(PortfolioAsset.portfolio_id == portfolio_id)
        .where(PortfolioAsset.asset_id == asset_id)
    )
    portfolio_asset = result.scalar_one_or_none()
    
    if not portfolio_asset:
        raise HTTPException(status_code=404, detail="Portfolio asset not found")
    
    await db.delete(portfolio_asset)
    await db.commit()
    
    return {"status": "removed", "asset_id": asset_id}


# ==================== REIT Metrics ====================

@router.get("/{portfolio_id}/reit-metrics", response_model=REITMetricsResponse)
async def get_reit_metrics(
    portfolio_id: str,
    shares_outstanding: Optional[float] = None,
    db: AsyncSession = Depends(get_db),
):
    """Calculate REIT metrics for a portfolio."""
    service = REITMetricsService(db)
    
    try:
        metrics = await service.calculate_metrics(
            portfolio_id=portfolio_id,
            shares_outstanding=shares_outstanding,
        )
        
        return REITMetricsResponse(
            portfolio_id=metrics.portfolio_id,
            portfolio_name=metrics.portfolio_name,
            as_of_date=metrics.as_of_date,
            nav=metrics.nav,
            nav_per_share=metrics.nav_per_share,
            ffo=metrics.ffo,
            affo=metrics.affo,
            dividend_yield=metrics.dividend_yield,
            earnings_yield=metrics.earnings_yield,
            debt_to_equity=metrics.debt_to_equity,
            loan_to_value=metrics.loan_to_value,
            interest_coverage=metrics.interest_coverage,
            occupancy=metrics.occupancy,
            noi=metrics.noi,
            cap_rate=metrics.cap_rate,
            ytd_return=metrics.ytd_return,
            asset_count=metrics.asset_count,
            total_gfa_m2=metrics.total_gfa_m2,
            var_95=metrics.var_95,
            climate_risk_score=metrics.climate_risk_score,
            sector_allocation=metrics.sector_allocation,
            geographic_allocation=metrics.geographic_allocation,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{portfolio_id}/analytics", response_model=dict)
async def get_portfolio_analytics(
    portfolio_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get portfolio analytics summary."""
    service = REITMetricsService(db)
    
    try:
        metrics = await service.calculate_metrics(portfolio_id)
        
        return {
            "summary": {
                "nav": metrics.nav,
                "ffo": metrics.ffo,
                "yield": metrics.dividend_yield,
                "occupancy": metrics.occupancy,
            },
            "risk": {
                "var_95": metrics.var_95,
                "climate_risk": metrics.climate_risk_score,
                "debt_to_equity": metrics.debt_to_equity,
            },
            "allocation": {
                "by_sector": metrics.sector_allocation,
                "by_geography": metrics.geographic_allocation,
            },
            "performance": {
                "ytd_return": metrics.ytd_return,
                "cap_rate": metrics.cap_rate,
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{portfolio_id}/map-data", response_model=list[dict])
async def get_portfolio_map_data(
    portfolio_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get assets for globe visualization."""
    from src.models.asset import Asset
    
    result = await db.execute(
        select(PortfolioAsset, Asset)
        .join(Asset, PortfolioAsset.asset_id == Asset.id)
        .where(PortfolioAsset.portfolio_id == portfolio_id)
    )
    portfolio_assets = list(result.fetchall())
    
    return [
        {
            "id": a.id,
            "name": a.name,
            "latitude": a.latitude,
            "longitude": a.longitude,
            "type": a.asset_type,
            "value": pa.current_value or a.current_valuation,
            "share_pct": pa.share_pct,
            "climate_risk": a.climate_risk_score,
        }
        for pa, a in portfolio_assets
        if a.latitude and a.longitude
    ]


@router.post("/{portfolio_id}/stress-test", response_model=dict)
async def run_portfolio_stress_test(
    portfolio_id: str,
    scenario: str = "rate_rise",
    db: AsyncSession = Depends(get_db),
):
    """
    Run stress test on portfolio.
    
    Scenarios:
    - rate_rise: Interest rate increase (+200bps)
    - rezone: Regulatory rezoning impact
    - climate: Climate stress scenario
    """
    service = REITMetricsService(db)
    
    try:
        metrics = await service.calculate_metrics(portfolio_id)
        
        # Apply stress scenario
        if scenario == "rate_rise":
            stressed_nav = metrics.nav * 0.90  # 10% NAV decline
            stressed_yield = metrics.dividend_yield * 1.15
            impact_description = "200bps rate increase impact"
        elif scenario == "rezone":
            stressed_nav = metrics.nav * 0.85
            stressed_yield = metrics.dividend_yield * 0.95
            impact_description = "Regulatory rezoning impact"
        elif scenario == "climate":
            stressed_nav = metrics.nav * (1 - metrics.climate_risk_score / 200)
            stressed_yield = metrics.dividend_yield * 0.90
            impact_description = "Climate stress scenario impact"
        else:
            stressed_nav = metrics.nav
            stressed_yield = metrics.dividend_yield
            impact_description = "No stress applied"
        
        return {
            "scenario": scenario,
            "impact_description": impact_description,
            "base_nav": metrics.nav,
            "stressed_nav": stressed_nav,
            "nav_change_pct": (stressed_nav - metrics.nav) / metrics.nav * 100,
            "base_yield": metrics.dividend_yield,
            "stressed_yield": stressed_yield,
            "yield_change_pct": (stressed_yield - metrics.dividend_yield) / metrics.dividend_yield * 100 if metrics.dividend_yield else 0,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{portfolio_id}/optimize", response_model=dict)
async def optimize_portfolio(
    portfolio_id: str,
    objective: str = "maximize_yield",
    db: AsyncSession = Depends(get_db),
):
    """
    Get portfolio optimization recommendations.
    
    Objectives:
    - maximize_yield: Optimize for dividend yield
    - minimize_risk: Minimize climate and concentration risk
    - balanced: Balance yield and risk
    """
    service = REITMetricsService(db)
    
    try:
        metrics = await service.calculate_metrics(portfolio_id)
        
        recommendations = []
        
        # Analyze concentration
        sector_max = max(metrics.sector_allocation.values()) if metrics.sector_allocation else 0
        if sector_max > 40:
            recommendations.append({
                "type": "diversification",
                "priority": "high",
                "description": "Reduce sector concentration - consider adding assets in underweight sectors",
            })
        
        # Analyze leverage
        if metrics.debt_to_equity > 1.5:
            recommendations.append({
                "type": "leverage",
                "priority": "medium",
                "description": "Consider reducing debt levels to improve financial flexibility",
            })
        
        # Analyze climate risk
        if metrics.climate_risk_score > 50:
            recommendations.append({
                "type": "risk_reduction",
                "priority": "high",
                "description": "High portfolio climate risk - consider divesting high-risk assets",
            })
        
        # Analyze occupancy
        if metrics.occupancy < 0.90:
            recommendations.append({
                "type": "operational",
                "priority": "medium",
                "description": "Improve occupancy through marketing or rent adjustments",
            })
        
        return {
            "objective": objective,
            "current_metrics": {
                "nav": metrics.nav,
                "yield": metrics.dividend_yield,
                "climate_risk": metrics.climate_risk_score,
                "concentration_max": sector_max,
            },
            "recommendations": recommendations,
            "target_metrics": {
                "yield": metrics.dividend_yield * 1.1 if objective == "maximize_yield" else metrics.dividend_yield,
                "climate_risk": metrics.climate_risk_score * 0.8 if objective == "minimize_risk" else metrics.climate_risk_score,
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
