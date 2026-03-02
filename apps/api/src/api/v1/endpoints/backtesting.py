"""Backtesting API: run strategy vs historical crises, persist and list runs."""
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from src.core.database import get_db
from src.services.backtesting_service import (
    get_backtest_run,
    get_backtest_runs,
    run_backtest,
)
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


class BacktestRunRequest(BaseModel):
    strategy_id: str = "default"
    scenario_type: str
    region_or_city: str
    event_type: str


@router.post("/run", response_model=dict)
async def post_backtest_run(
    body: BacktestRunRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Run backtest: strategy/scenario x region x event_type.
    Returns run id, list of events (predicted vs actual), and metrics (MAE, MAPE, hit rate).
    """
    return await run_backtest(
        db,
        strategy_id=body.strategy_id,
        scenario_type=body.scenario_type,
        region_or_city=body.region_or_city,
        event_type=body.event_type,
    )


@router.get("/runs", response_model=List[dict])
async def list_backtest_runs(
    limit: int = Query(default=50, ge=1, le=200),
    strategy_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    """List recent backtest runs, optionally filtered by strategy_id."""
    return await get_backtest_runs(db, limit=limit, strategy_id=strategy_id)


@router.get("/runs/{run_id}", response_model=dict)
async def get_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get one backtest run by id, including full events list."""
    out = await get_backtest_run(db, run_id)
    if out is None:
        raise HTTPException(status_code=404, detail="Backtest run not found")
    return out
