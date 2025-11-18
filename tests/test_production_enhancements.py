"""
Tests for Production Enhancements

Comprehensive test coverage for production features.
"""

import pytest
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

# Test imports
from libs.data_integration.bloomberg_api import BloombergAPIConnector
from libs.data_integration.refinitiv_api import RefinitivAPIConnector
from libs.streaming.kafka_streamer import KafkaStreamer
from libs.ml_models.early_warning_ml import EarlyWarningMLModel
from libs.performance.optimizer import PerformanceOptimizer, LRUCache


class TestBloombergAPI:
    """Tests for Bloomberg API connector."""

    def test_connection(self):
        """Test Bloomberg API connection."""
        connector = BloombergAPIConnector()
        # In production, would test actual connection
        assert connector.host == "localhost"
        assert connector.port == 8194

    def test_reference_data(self):
        """Test reference data retrieval."""
        connector = BloombergAPIConnector()
        connector.connected = True  # Mock connection

        securities = ["AAPL US Equity", "MSFT US Equity"]
        fields = ["PX_LAST", "VOLUME"]
        data = connector.get_reference_data(securities, fields)

        assert len(data) == len(securities)
        assert all(field in data.columns for field in fields)

    def test_historical_data(self):
        """Test historical data retrieval."""
        connector = BloombergAPIConnector()
        connector.connected = True

        start_date = datetime(2023, 1, 1)
        end_date = datetime(2023, 12, 31)
        data = connector.get_historical_data(
            ["AAPL US Equity"],
            ["PX_LAST"],
            start_date,
            end_date,
        )

        assert len(data) > 0


class TestRefinitivAPI:
    """Tests for Refinitiv API connector."""

    def test_connection(self):
        """Test Refinitiv API connection."""
        connector = RefinitivAPIConnector(app_key="test_key")
        assert connector.app_key == "test_key"

    def test_data_retrieval(self):
        """Test data retrieval."""
        connector = RefinitivAPIConnector(app_key="test_key")
        connector.connected = True

        instruments = ["AAPL.O", "MSFT.O"]
        fields = ["TR.PriceClose", "TR.Volume"]
        data = connector.get_data(instruments, fields)

        assert len(data) == len(instruments)


class TestKafkaStreamer:
    """Tests for Kafka streamer."""

    def test_connection(self):
        """Test Kafka connection."""
        streamer = KafkaStreamer(bootstrap_servers=["localhost:9092"])
        # In production, would test actual connection
        assert streamer.bootstrap_servers == ["localhost:9092"]

    def test_publish_metrics(self):
        """Test publishing metrics."""
        streamer = KafkaStreamer()
        streamer.connected = True

        metrics = {"var": 1000000, "cvar": 1300000}
        result = streamer.publish_risk_metrics("portfolio_1", metrics)
        assert result is True


class TestMLModels:
    """Tests for ML models."""

    def test_early_warning_model(self):
        """Test early warning ML model."""
        model = EarlyWarningMLModel(model_type="random_forest")

        # Create sample data
        features = pd.DataFrame({
            "vix": np.random.uniform(10, 40, 100),
            "cds_spread": np.random.uniform(50, 300, 100),
            "yield_curve": np.random.uniform(-1, 1, 100),
        })
        labels = pd.Series(np.random.randint(0, 2, 100))

        # Train
        metrics = model.train(features, labels)
        assert "train_accuracy" in metrics
        assert "test_accuracy" in metrics

        # Predict
        predictions = model.predict(features)
        assert len(predictions) == len(features)
        assert all(0 <= p <= 1 for p in predictions)

    def test_feature_importance(self):
        """Test feature importance."""
        model = EarlyWarningMLModel()
        model.trained = True
        model.feature_names = ["vix", "cds_spread", "yield_curve"]

        importance = model.get_feature_importance()
        assert len(importance) == 3
        assert all(name in importance.index for name in model.feature_names)


class TestPerformanceOptimizer:
    """Tests for performance optimizer."""

    def test_lru_cache(self):
        """Test LRU cache."""
        cache = LRUCache(max_size=3)

        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.set("key3", "value3")

        assert cache.get("key1") == "value1"

        # Add new item, should evict least recently used
        cache.set("key4", "value4")
        assert cache.get("key1") is None  # Should be evicted
        assert cache.get("key2") == "value2"

    def test_cached_calculation(self):
        """Test cached calculation."""
        optimizer = PerformanceOptimizer()

        call_count = [0]

        def expensive_function():
            call_count[0] += 1
            return 42

        cache_key = "test_key"

        # First call - should execute
        result1 = optimizer.cached_calculation(expensive_function, cache_key)
        assert result1 == 42
        assert call_count[0] == 1

        # Second call - should use cache
        result2 = optimizer.cached_calculation(expensive_function, cache_key)
        assert result2 == 42
        assert call_count[0] == 1  # Should not increment

    def test_index_creation(self):
        """Test index creation."""
        optimizer = PerformanceOptimizer()

        data = pd.DataFrame({
            "portfolio_id": ["p1", "p1", "p2", "p2"],
            "metric": ["var", "cvar", "var", "cvar"],
            "value": [100, 130, 200, 260],
        })

        optimizer.create_index("test_index", data, ["portfolio_id", "metric"])

        assert "test_index" in optimizer.indexes

    def test_indexed_query(self):
        """Test indexed query."""
        optimizer = PerformanceOptimizer()

        data = pd.DataFrame({
            "portfolio_id": ["p1", "p1", "p2", "p2"],
            "metric": ["var", "cvar", "var", "cvar"],
            "value": [100, 130, 200, 260],
        })

        optimizer.create_index("test_index", data, ["portfolio_id"])

        result = optimizer.query_indexed("test_index", {"portfolio_id": "p1"})
        assert len(result) == 2
        assert all(result["portfolio_id"] == "p1")

    def test_batch_processing(self):
        """Test batch processing."""
        optimizer = PerformanceOptimizer()

        items = list(range(250))
        processor = lambda batch: [x * 2 for x in batch]

        results = optimizer.batch_process(items, processor, batch_size=100)

        assert len(results) == 250
        assert results[0] == 0
        assert results[100] == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

