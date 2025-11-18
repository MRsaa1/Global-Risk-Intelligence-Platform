"""
Portfolio and position schemas using PyArrow/Parquet.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PositionSchema(BaseModel):
    """Schema for a single position."""

    position_id: str
    portfolio_id: str
    as_of_date: datetime

    # Instrument details
    instrument_id: str
    instrument_type: str = Field(..., description="bond, loan, derivative, etc.")
    asset_class: str = Field(..., description="corporate, sovereign, retail, etc.")

    # Position details
    notional: float
    market_value: float
    currency: str = Field(default="USD")

    # Risk characteristics
    rating: Optional[str] = None
    maturity_date: Optional[datetime] = None
    sector: Optional[str] = None
    country: Optional[str] = None

    # Counterparty
    counterparty_id: Optional[str] = None
    counterparty_lei: Optional[str] = None

    # Regulatory fields
    risk_weight: Optional[float] = None
    risk_weighted_assets: Optional[float] = None

    class Config:
        json_schema_extra = {
            "example": {
                "position_id": "pos_001",
                "portfolio_id": "portfolio_001",
                "as_of_date": "2024-01-15T00:00:00Z",
                "instrument_id": "bond_001",
                "instrument_type": "bond",
                "asset_class": "corporate",
                "notional": 1000000.0,
                "market_value": 980000.0,
                "currency": "USD",
                "rating": "BBB",
                "maturity_date": "2029-01-15T00:00:00Z",
                "sector": "Financial",
                "country": "US",
                "counterparty_id": "cpty_001",
                "counterparty_lei": "12345678901234567890",
                "risk_weight": 1.0,
                "risk_weighted_assets": 1000000.0,
            }
        }


class PortfolioSchema(BaseModel):
    """Schema for a portfolio."""

    portfolio_id: str
    portfolio_name: str
    as_of_date: datetime

    # Portfolio metadata
    currency: str = Field(default="USD")
    entity_id: Optional[str] = None
    entity_lei: Optional[str] = None

    # Aggregated metrics
    total_notional: float = 0.0
    total_market_value: float = 0.0
    total_rwa: float = 0.0

    # Positions
    positions: List[PositionSchema] = Field(default_factory=list)

    def to_parquet(self, file_path: str) -> None:
        """Save portfolio to Parquet file."""
        import pandas as pd
        import pyarrow as pa
        import pyarrow.parquet as pq

        # Convert positions to DataFrame
        positions_data = [pos.model_dump() for pos in self.positions]
        df = pd.DataFrame(positions_data)

        # Convert to PyArrow table
        table = pa.Table.from_pandas(df)

        # Write to Parquet
        pq.write_table(table, file_path)

    @classmethod
    def from_parquet(cls, file_path: str, portfolio_id: str, as_of_date: datetime) -> "PortfolioSchema":
        """Load portfolio from Parquet file."""
        import pandas as pd
        import pyarrow.parquet as pq

        # Read Parquet
        table = pq.read_table(file_path)
        df = table.to_pandas()

        # Convert to PositionSchema objects
        positions = [PositionSchema(**row.to_dict()) for _, row in df.iterrows()]

        # Calculate aggregates
        total_notional = sum(pos.notional for pos in positions)
        total_market_value = sum(pos.market_value for pos in positions)
        total_rwa = sum(pos.risk_weighted_assets or 0.0 for pos in positions)

        return cls(
            portfolio_id=portfolio_id,
            portfolio_name=portfolio_id,  # Default name
            as_of_date=as_of_date,
            total_notional=total_notional,
            total_market_value=total_market_value,
            total_rwa=total_rwa,
            positions=positions,
        )

