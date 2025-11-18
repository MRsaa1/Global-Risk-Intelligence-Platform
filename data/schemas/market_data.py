"""
Market data schemas for rates, prices, and market indicators.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MarketDataSchema(BaseModel):
    """Schema for market data point."""

    data_id: str
    data_type: str = Field(..., description="rate, price, index, etc.")
    asset_class: str
    as_of_date: datetime

    # Value
    value: float

    # Metadata
    currency: Optional[str] = None
    tenor: Optional[str] = Field(None, description="e.g., 1Y, 5Y, 10Y for rates")
    source: Optional[str] = Field(None, description="data source/provider")

    class Config:
        json_schema_extra = {
            "example": {
                "data_id": "usd_3m_libor_20240115",
                "data_type": "rate",
                "asset_class": "interest_rate",
                "as_of_date": "2024-01-15T00:00:00Z",
                "value": 0.0525,
                "currency": "USD",
                "tenor": "3M",
                "source": "Bloomberg",
            }
        }


class YieldCurveSchema(BaseModel):
    """Schema for yield curve."""

    curve_id: str
    currency: str
    as_of_date: datetime

    # Curve points
    tenors: List[str] = Field(..., description="e.g., ['1M', '3M', '6M', '1Y', ...]")
    rates: List[float] = Field(..., description="Rates corresponding to tenors")

    # Metadata
    curve_type: str = Field(default="spot", description="spot, forward, par")
    source: Optional[str] = None

    def get_rate(self, tenor: str) -> Optional[float]:
        """Get rate for a specific tenor."""
        try:
            index = self.tenors.index(tenor)
            return self.rates[index]
        except ValueError:
            return None

    def interpolate(self, target_tenor: str) -> Optional[float]:
        """Interpolate rate for target tenor (simplified)."""
        # Placeholder - would use proper interpolation (linear, cubic, etc.)
        return None


class MarketDataSnapshot(BaseModel):
    """Schema for market data snapshot at a point in time."""

    snapshot_id: str
    as_of_date: datetime

    # Market data points
    market_data: List[MarketDataSchema] = Field(default_factory=list)

    # Yield curves
    yield_curves: List[YieldCurveSchema] = Field(default_factory=list)

    def get_data_by_type(self, data_type: str) -> List[MarketDataSchema]:
        """Get all market data of a specific type."""
        return [data for data in self.market_data if data.data_type == data_type]

    def get_yield_curve(self, currency: str) -> Optional[YieldCurveSchema]:
        """Get yield curve for a currency."""
        for curve in self.yield_curves:
            if curve.currency == currency:
                return curve
        return None

