"""Performance tests."""

import pytest
import time
from datetime import datetime

from libs.dsl_schema import ScenarioDSL, ScenarioMetadata, RegulatoryRule
from libs.dsl_schema.schema import Jurisdiction, RegulatoryFramework, PortfolioReference
from apps.reg_calculator.engine import DistributedCalculationEngine
from libs.performance.cache import CacheManager, cached
from libs.performance.batching import batch_process


@pytest.mark.performance
class TestPerformance:
    """Performance tests."""

    def test_calculation_performance(self):
        """Test calculation engine performance."""
        metadata = ScenarioMetadata(scenario_id="perf_test", name="Performance Test")
        portfolio = PortfolioReference(
            portfolio_id="test", as_of_date=datetime.utcnow()
        )

        scenario = ScenarioDSL(
            metadata=metadata,
            portfolio=portfolio,
            regulatory_rules=[
                RegulatoryRule(
                    framework=RegulatoryFramework.BASEL_IV,
                    jurisdiction=Jurisdiction.US_FED,
                )
            ],
            calculation_steps=[],
            outputs=[],
        )

        engine = DistributedCalculationEngine(backend="ray", cache_enabled=False)

        start_time = time.time()
        results = engine.execute(scenario, "test")
        elapsed = time.time() - start_time

        assert results["status"] == "success"
        assert elapsed < 5.0  # Should complete in under 5 seconds

    def test_cache_performance(self):
        """Test cache performance improvement."""
        cache = CacheManager(default_ttl=3600)

        @cached(ttl=3600, cache_manager=cache)
        def expensive_function(x: int) -> int:
            time.sleep(0.1)  # Simulate expensive operation
            return x * 2

        # First call - cache miss
        start = time.time()
        result1 = expensive_function(5)
        first_call_time = time.time() - start

        # Second call - cache hit
        start = time.time()
        result2 = expensive_function(5)
        second_call_time = time.time() - start

        assert result1 == result2 == 10
        assert second_call_time < first_call_time * 0.1  # Cache should be much faster

    def test_batch_processing_performance(self):
        """Test batch processing performance."""
        items = list(range(1000))

        def process_batch(batch):
            # Simulate processing
            time.sleep(0.001)
            return [x * 2 for x in batch]

        start = time.time()
        results = batch_process(items, process_batch, batch_size=100)
        elapsed = time.time() - start

        assert len(results) == 1000
        assert elapsed < 2.0  # Should complete in reasonable time

    def test_concurrent_calculations(self):
        """Test concurrent calculation performance."""
        import concurrent.futures

        metadata = ScenarioMetadata(scenario_id="concurrent_test", name="Concurrent Test")
        portfolio = PortfolioReference(
            portfolio_id="test", as_of_date=datetime.utcnow()
        )

        scenario = ScenarioDSL(
            metadata=metadata,
            portfolio=portfolio,
            regulatory_rules=[
                RegulatoryRule(
                    framework=RegulatoryFramework.BASEL_IV,
                    jurisdiction=Jurisdiction.US_FED,
                )
            ],
            calculation_steps=[],
            outputs=[],
        )

        engine = DistributedCalculationEngine(backend="ray", cache_enabled=True)

        def run_calculation():
            return engine.execute(scenario, "test")

        start = time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(run_calculation) for _ in range(10)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]
        elapsed = time.time() - start

        assert all(r["status"] == "success" for r in results)
        assert elapsed < 10.0  # Should complete in reasonable time

