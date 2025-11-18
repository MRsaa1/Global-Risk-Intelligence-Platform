"""
Data Adapters - Integration with real data sources.

Provides adapters for portfolio data, market data, and entity data
from various sources (databases, APIs, files).
"""

from libs.data_adapters.portfolio_adapter import PortfolioAdapter, PortfolioDataSource
from libs.data_adapters.market_data_adapter import MarketDataAdapter, MarketDataSource
from libs.data_adapters.entity_adapter import EntityAdapter

__all__ = [
    "PortfolioAdapter",
    "PortfolioDataSource",
    "MarketDataAdapter",
    "MarketDataSource",
    "EntityAdapter",
]

__version__ = "1.0.0"

