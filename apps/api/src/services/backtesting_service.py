"""
Backtesting service: run strategy/scenario against historical crisis events.

Uses stress_report_metrics._get_backtesting_events for region- and event-type-aware
historical events; computes MAE, MAPE, hit rate; persists runs to backtest_runs table.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.backtest_run import BacktestRun
from src.services.stress_report_metrics import _get_backtesting_events

logger = logging.getLogger(__name__)


def _compute_metrics(events: List[Dict[str, Any]]) -> Dict[str, float]:
    """Compute MAE (EUR m), MAPE (%), and hit rate (%) from backtesting events."""
    if not events:
        return {"mae_eur_m": None, "mape_pct": None, "hit_rate_pct": None}
    errors_abs = []
    errors_pct = []
    hits = 0
    for e in events:
        pred = e.get("predicted_eur_m") or 0
        actual = e.get("actual_eur_m") or 0
        errors_abs.append(abs((pred - actual)))
        if actual != 0:
            errors_pct.append(abs((pred - actual) / actual) * 100)
        # Hit: prediction within 20% of actual
        if actual != 0 and abs(pred - actual) / actual <= 0.20:
            hits += 1
    mae = sum(errors_abs) / len(errors_abs) if errors_abs else None
    mape = sum(errors_pct) / len(errors_pct) if errors_pct else None
    hit_rate = (hits / len(events)) * 100 if events else None
    return {"mae_eur_m": mae, "mape_pct": mape, "hit_rate_pct": hit_rate}


async def run_backtest(
    db: AsyncSession,
    strategy_id: str,
    scenario_type: str,
    region_or_city: str,
    event_type: str,
) -> Dict[str, Any]:
    """
    Run backtest: get historical events for region/event_type, compute metrics, persist run.
    Returns run id, events list, and aggregated metrics.
    """
    events = _get_backtesting_events(region_or_city, event_type)
    metrics = _compute_metrics(events)
    run_id = str(uuid4())
    run = BacktestRun(
        id=run_id,
        strategy_id=strategy_id,
        scenario_type=scenario_type,
        region_or_city=region_or_city,
        event_type=event_type,
        run_at=datetime.now(timezone.utc),
        events_json=json.dumps(events) if events else None,
        event_count=len(events),
        mae_eur_m=metrics["mae_eur_m"],
        mape_pct=metrics["mape_pct"],
        hit_rate_pct=metrics["hit_rate_pct"],
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return {
        "run_id": run_id,
        "strategy_id": strategy_id,
        "scenario_type": scenario_type,
        "region_or_city": region_or_city,
        "event_type": event_type,
        "run_at": run.run_at.isoformat() if run.run_at else None,
        "events": events,
        "event_count": len(events),
        "mae_eur_m": metrics["mae_eur_m"],
        "mape_pct": metrics["mape_pct"],
        "hit_rate_pct": metrics["hit_rate_pct"],
    }


async def get_backtest_runs(
    db: AsyncSession,
    limit: int = 50,
    strategy_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """List recent backtest runs, optionally filtered by strategy_id."""
    from sqlalchemy import desc
    q = select(BacktestRun).order_by(desc(BacktestRun.run_at)).limit(limit)
    if strategy_id:
        q = q.where(BacktestRun.strategy_id == strategy_id)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "strategy_id": r.strategy_id,
            "scenario_type": r.scenario_type,
            "region_or_city": r.region_or_city,
            "event_type": r.event_type,
            "run_at": r.run_at.isoformat() if r.run_at else None,
            "event_count": r.event_count,
            "mae_eur_m": r.mae_eur_m,
            "mape_pct": r.mape_pct,
            "hit_rate_pct": r.hit_rate_pct,
        }
        for r in rows
    ]


async def get_backtest_run(db: AsyncSession, run_id: str) -> Optional[Dict[str, Any]]:
    """Get one backtest run by id, including full events_json."""
    result = await db.execute(select(BacktestRun).where(BacktestRun.id == run_id))
    r = result.scalar_one_or_none()
    if not r:
        return None
    events = json.loads(r.events_json) if r.events_json else []
    return {
        "id": r.id,
        "strategy_id": r.strategy_id,
        "scenario_type": r.scenario_type,
        "region_or_city": r.region_or_city,
        "event_type": r.event_type,
        "run_at": r.run_at.isoformat() if r.run_at else None,
        "events": events,
        "event_count": r.event_count,
        "mae_eur_m": r.mae_eur_m,
        "mape_pct": r.mape_pct,
        "hit_rate_pct": r.hit_rate_pct,
    }
