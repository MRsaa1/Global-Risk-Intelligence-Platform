"""
Portfolio data adapter for loading portfolio data from various sources.
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional
import structlog

from data.schemas.portfolio import PortfolioSchema, PositionSchema

logger = structlog.get_logger(__name__)


class PortfolioDataSource(ABC):
    """Abstract base class for portfolio data sources."""

    @abstractmethod
    def load_portfolio(
        self, portfolio_id: str, as_of_date: datetime
    ) -> Dict[str, Any]:
        """Load portfolio data."""
        pass

    @abstractmethod
    def load_positions(
        self, portfolio_id: str, as_of_date: datetime
    ) -> List[Dict[str, Any]]:
        """Load positions for a portfolio."""
        pass


class DatabasePortfolioSource(PortfolioDataSource):
    """Portfolio data from database."""

    def __init__(self, connection_string: str):
        """
        Initialize database portfolio source.

        Args:
            connection_string: Database connection string
        """
        self.connection_string = connection_string
        # In production, would initialize database connection

    def load_portfolio(self, portfolio_id: str, as_of_date: datetime) -> Dict[str, Any]:
        """Load portfolio from database."""
        logger.info("Loading portfolio from database", portfolio_id=portfolio_id)

        # Placeholder - would query database
        # Example SQL:
        # SELECT * FROM portfolios WHERE portfolio_id = ? AND as_of_date = ?

        return {
            "portfolio_id": portfolio_id,
            "portfolio_name": f"Portfolio {portfolio_id}",
            "as_of_date": as_of_date,
            "currency": "USD",
        }

    def load_positions(self, portfolio_id: str, as_of_date: datetime) -> List[Dict[str, Any]]:
        """Load positions from database."""
        logger.info("Loading positions from database", portfolio_id=portfolio_id)

        # Placeholder - would query database
        # Example SQL:
        # SELECT * FROM positions WHERE portfolio_id = ? AND as_of_date = ?

        return []


class FilePortfolioSource(PortfolioDataSource):
    """Portfolio data from files (Parquet, CSV, Excel)."""

    def __init__(self, base_path: str):
        """
        Initialize file portfolio source.

        Args:
            base_path: Base path for portfolio files
        """
        self.base_path = base_path

    def load_portfolio(self, portfolio_id: str, as_of_date: datetime) -> Dict[str, Any]:
        """Load portfolio from file."""
        logger.info("Loading portfolio from file", portfolio_id=portfolio_id)

        # Try Parquet first, then CSV
        import os
        from pathlib import Path

        parquet_path = Path(self.base_path) / f"{portfolio_id}_{as_of_date.date()}.parquet"
        csv_path = Path(self.base_path) / f"{portfolio_id}_{as_of_date.date()}.csv"

        if parquet_path.exists():
            portfolio = PortfolioSchema.from_parquet(str(parquet_path), portfolio_id, as_of_date)
            return portfolio.model_dump()
        elif csv_path.exists():
            # Load from CSV
            import pandas as pd

            df = pd.read_csv(csv_path)
            positions = [PositionSchema(**row.to_dict()) for _, row in df.iterrows()]

            return PortfolioSchema(
                portfolio_id=portfolio_id,
                portfolio_name=portfolio_id,
                as_of_date=as_of_date,
                positions=positions,
            ).model_dump()

        raise FileNotFoundError(f"Portfolio file not found: {portfolio_id}")

    def load_positions(self, portfolio_id: str, as_of_date: datetime) -> List[Dict[str, Any]]:
        """Load positions from file."""
        portfolio_data = self.load_portfolio(portfolio_id, as_of_date)
        return [pos.model_dump() for pos in portfolio_data.get("positions", [])]


class APIPortfolioSource(PortfolioDataSource):
    """Portfolio data from REST API."""

    def __init__(self, api_url: str, api_key: Optional[str] = None):
        """
        Initialize API portfolio source.

        Args:
            api_url: Base URL of the API
            api_key: Optional API key for authentication
        """
        self.api_url = api_url
        self.api_key = api_key

    def load_portfolio(self, portfolio_id: str, as_of_date: datetime) -> Dict[str, Any]:
        """Load portfolio from API."""
        logger.info("Loading portfolio from API", portfolio_id=portfolio_id)

        import httpx

        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        # Placeholder - would make actual API call
        # response = httpx.get(
        #     f"{self.api_url}/portfolios/{portfolio_id}",
        #     params={"as_of_date": as_of_date.isoformat()},
        #     headers=headers,
        # )
        # return response.json()

        return {
            "portfolio_id": portfolio_id,
            "portfolio_name": f"Portfolio {portfolio_id}",
            "as_of_date": as_of_date,
        }

    def load_positions(self, portfolio_id: str, as_of_date: datetime) -> List[Dict[str, Any]]:
        """Load positions from API."""
        logger.info("Loading positions from API", portfolio_id=portfolio_id)

        # Placeholder - would make actual API call
        return []


class PortfolioAdapter:
    """Adapter for loading portfolio data from various sources."""

    def __init__(self, source: PortfolioDataSource):
        """
        Initialize portfolio adapter.

        Args:
            source: Portfolio data source
        """
        self.source = source

    def get_portfolio(
        self, portfolio_id: str, as_of_date: datetime
    ) -> PortfolioSchema:
        """
        Get portfolio with positions.

        Args:
            portfolio_id: Portfolio identifier
            as_of_date: As-of date

        Returns:
            PortfolioSchema instance
        """
        portfolio_data = self.source.load_portfolio(portfolio_id, as_of_date)
        positions_data = self.source.load_positions(portfolio_id, as_of_date)

        # Convert positions to PositionSchema
        positions = [PositionSchema(**pos) for pos in positions_data]

        # Calculate aggregates
        total_notional = sum(pos.notional for pos in positions)
        total_market_value = sum(pos.market_value for pos in positions)
        total_rwa = sum(pos.risk_weighted_assets or 0.0 for pos in positions)

        return PortfolioSchema(
            portfolio_id=portfolio_id,
            portfolio_name=portfolio_data.get("portfolio_name", portfolio_id),
            as_of_date=as_of_date,
            currency=portfolio_data.get("currency", "USD"),
            entity_id=portfolio_data.get("entity_id"),
            entity_lei=portfolio_data.get("entity_lei"),
            total_notional=total_notional,
            total_market_value=total_market_value,
            total_rwa=total_rwa,
            positions=positions,
        )

    def get_portfolio_summary(self, portfolio_id: str, as_of_date: datetime) -> Dict[str, Any]:
        """Get portfolio summary without full positions."""
        portfolio = self.get_portfolio(portfolio_id, as_of_date)
        return {
            "portfolio_id": portfolio.portfolio_id,
            "portfolio_name": portfolio.portfolio_name,
            "as_of_date": portfolio.as_of_date,
            "total_notional": portfolio.total_notional,
            "total_market_value": portfolio.total_market_value,
            "total_rwa": portfolio.total_rwa,
            "position_count": len(portfolio.positions),
        }

