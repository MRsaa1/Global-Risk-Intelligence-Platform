"""
Market data adapter for loading market data from various sources.
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional
import structlog

from data.schemas.market_data import MarketDataSchema, YieldCurveSchema, MarketDataSnapshot

logger = structlog.get_logger(__name__)


class MarketDataSource(ABC):
    """Abstract base class for market data sources."""

    @abstractmethod
    def get_market_data(
        self, data_type: str, asset_class: str, as_of_date: datetime
    ) -> Optional[MarketDataSchema]:
        """Get market data point."""
        pass

    @abstractmethod
    def get_yield_curve(
        self, currency: str, as_of_date: datetime
    ) -> Optional[YieldCurveSchema]:
        """Get yield curve."""
        pass


class DatabaseMarketDataSource(MarketDataSource):
    """Market data from database."""

    def __init__(self, connection_string: str):
        """Initialize database market data source."""
        self.connection_string = connection_string

    def get_market_data(
        self, data_type: str, asset_class: str, as_of_date: datetime
    ) -> Optional[MarketDataSchema]:
        """Get market data from database."""
        logger.info(
            "Loading market data from database",
            data_type=data_type,
            asset_class=asset_class,
        )

        # Placeholder - would query database
        return None

    def get_yield_curve(
        self, currency: str, as_of_date: datetime
    ) -> Optional[YieldCurveSchema]:
        """Get yield curve from database."""
        logger.info("Loading yield curve from database", currency=currency)

        # Placeholder - would query database
        return None


class BloombergMarketDataSource(MarketDataSource):
    """Market data from Bloomberg API (placeholder)."""

    def __init__(self, api_key: str):
        """Initialize Bloomberg data source."""
        self.api_key = api_key

    def get_market_data(
        self, data_type: str, asset_class: str, as_of_date: datetime
    ) -> Optional[MarketDataSchema]:
        """Get market data from Bloomberg."""
        logger.info("Loading market data from Bloomberg", data_type=data_type)

        # Placeholder - would use Bloomberg API
        # In production: blpapi or similar
        return None

    def get_yield_curve(
        self, currency: str, as_of_date: datetime
    ) -> Optional[YieldCurveSchema]:
        """Get yield curve from Bloomberg."""
        logger.info("Loading yield curve from Bloomberg", currency=currency)

        # Placeholder - would use Bloomberg API
        return None


class FileMarketDataSource(MarketDataSource):
    """Market data from files."""

    def __init__(self, base_path: str):
        """Initialize file market data source."""
        self.base_path = base_path

    def get_market_data(
        self, data_type: str, asset_class: str, as_of_date: datetime
    ) -> Optional[MarketDataSchema]:
        """Get market data from file."""
        logger.info("Loading market data from file", data_type=data_type)

        # Placeholder - would load from CSV/Parquet
        return None

    def get_yield_curve(
        self, currency: str, as_of_date: datetime
    ) -> Optional[YieldCurveSchema]:
        """Get yield curve from file."""
        logger.info("Loading yield curve from file", currency=currency)

        # Placeholder - would load from file
        return None


class MarketDataAdapter:
    """Adapter for loading market data from various sources."""

    def __init__(self, source: MarketDataSource):
        """Initialize market data adapter."""
        self.source = source

    def get_market_snapshot(self, as_of_date: datetime) -> MarketDataSnapshot:
        """
        Get complete market data snapshot.

        Args:
            as_of_date: As-of date

        Returns:
            MarketDataSnapshot
        """
        logger.info("Loading market data snapshot", as_of_date=as_of_date)

        # Load common market data points
        market_data = []

        # Interest rates
        for tenor in ["1M", "3M", "6M", "1Y", "2Y", "5Y", "10Y", "30Y"]:
            data = self.source.get_market_data("rate", "interest_rate", as_of_date)
            if data:
                market_data.append(data)

        # Yield curves
        yield_curves = []
        for currency in ["USD", "EUR", "GBP"]:
            curve = self.source.get_yield_curve(currency, as_of_date)
            if curve:
                yield_curves.append(curve)

        return MarketDataSnapshot(
            snapshot_id=f"snapshot_{as_of_date.date()}",
            as_of_date=as_of_date,
            market_data=market_data,
            yield_curves=yield_curves,
        )

    def get_rate(
        self, currency: str, tenor: str, as_of_date: datetime
    ) -> Optional[float]:
        """Get specific interest rate."""
        curve = self.source.get_yield_curve(currency, as_of_date)
        if curve:
            return curve.get_rate(tenor)
        return None

