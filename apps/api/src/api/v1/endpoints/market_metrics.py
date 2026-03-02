"""Market metrics API: volatility and liquidity for stress scenarios."""
from typing import List, Optional

from fastapi import APIRouter, Query

from src.services.market_metrics_service import (
    get_current_volatility_and_liquidity,
    compute_volatility,
    compute_liquidity_score,
)
from pydantic import BaseModel

router = APIRouter()


@router.get("/volatility-and-liquidity")
async def get_volatility_and_liquidity(
    instrument_ids: Optional[str] = Query(None, description="Comma-separated instrument ids"),
):
    """Current volatility and liquidity metrics (for volatility_spike / liquidity_dry_up scenarios)."""
    ids = [x.strip() for x in (instrument_ids or "").split(",") if x.strip()] or None
    return get_current_volatility_and_liquidity(instrument_ids=ids)


class VolatilityRequest(BaseModel):
    returns: List[float]


@router.post("/volatility")
async def post_volatility(body: VolatilityRequest):
    """Compute realized volatility (annualized) from a list of period returns."""
    return {"volatility_annual": compute_volatility(body.returns)}


class LiquidityRequest(BaseModel):
    volumes: Optional[List[float]] = None
    spread_bps: Optional[float] = None


@router.post("/liquidity-score")
async def post_liquidity_score(body: LiquidityRequest):
    """Compute liquidity score 0-1 from volumes and/or spread_bps."""
    return {"liquidity_score": compute_liquidity_score(volumes=body.volumes, spread_bps=body.spread_bps)}
