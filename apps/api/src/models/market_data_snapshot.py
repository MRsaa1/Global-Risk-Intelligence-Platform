"""Market data snapshots for history, SRO and backtesting."""
from datetime import datetime
from typing import Any, Dict

from sqlalchemy import DateTime, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class MarketDataSnapshot(Base):
    """One captured snapshot of VIX, SPX, HYG, LQD, 10Y, EURUSD from market_data_job."""
    __tablename__ = "market_data_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    values: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
