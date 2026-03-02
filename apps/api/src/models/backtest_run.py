"""Backtesting run record for strategy vs historical crises."""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class BacktestRun(Base):
    """Stored result of a backtesting run (strategy/scenario x region x event_type)."""
    __tablename__ = "backtest_runs"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    strategy_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    scenario_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    region_or_city: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    run_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    events_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    event_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    mae_eur_m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    mape_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    hit_rate_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    dataset_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    event_uid: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
