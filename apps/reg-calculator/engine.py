"""
Distributed calculation engine with Ray/Dask support.
"""

import hashlib
import json
from typing import Any, Dict, List, Optional

import structlog

from libs.dsl_schema.schema import ScenarioDSL
from libs.reg_rules.engine import RulesEngine

logger = structlog.get_logger(__name__)


class DistributedCalculationEngine:
    """Distributed calculation engine with caching support."""

    def __init__(
        self,
        backend: str = "ray",
        cache_enabled: bool = True,
        redis_url: Optional[str] = None,
    ):
        """
        Initialize calculation engine.

        Args:
            backend: "ray" or "dask"
            cache_enabled: Enable content-addressable caching
            redis_url: Redis URL for cache (optional)
        """
        self.backend = backend
        self.cache_enabled = cache_enabled
        self.redis_url = redis_url
        self.rules_engine = RulesEngine()
        self._cache: Dict[str, Any] = {}

        if backend == "ray":
            try:
                import ray

                if not ray.is_initialized():
                    ray.init(ignore_reinit_error=True)
                self._ray_available = True
            except ImportError:
                logger.warning("Ray not available, falling back to sequential execution")
                self._ray_available = False
        elif backend == "dask":
            try:
                from dask.distributed import Client

                self._dask_client = Client()
                self._dask_available = True
            except ImportError:
                logger.warning("Dask not available, falling back to sequential execution")
                self._dask_available = False
        else:
            raise ValueError(f"Unsupported backend: {backend}")

    def _compute_cache_key(self, scenario: ScenarioDSL, portfolio_id: str) -> str:
        """Compute content-addressable cache key."""
        cache_data = {
            "scenario_id": scenario.metadata.scenario_id,
            "portfolio_id": portfolio_id,
            "market_shocks": [
                {
                    "type": shock.type.value,
                    "asset_class": shock.asset_class,
                    "shock_value": shock.shock_value,
                }
                for shock in scenario.market_shocks
            ],
            "regulatory_rules": [
                {
                    "framework": rule.framework.value,
                    "jurisdiction": rule.jurisdiction.value,
                    "rule_version": rule.rule_version,
                }
                for rule in scenario.regulatory_rules
            ],
        }
        cache_str = json.dumps(cache_data, sort_keys=True)
        return hashlib.sha256(cache_str.encode()).hexdigest()

    def _get_from_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get result from cache."""
        if not self.cache_enabled:
            return None

        if self.redis_url:
            try:
                import redis

                r = redis.from_url(self.redis_url)
                cached = r.get(f"calc:{cache_key}")
                if cached:
                    return json.loads(cached)
            except Exception as e:
                logger.warning("Cache retrieval failed", error=str(e))

        return self._cache.get(cache_key)

    def _store_in_cache(self, cache_key: str, result: Dict[str, Any]) -> None:
        """Store result in cache."""
        if not self.cache_enabled:
            return

        if self.redis_url:
            try:
                import redis

                r = redis.from_url(self.redis_url)
                r.setex(
                    f"calc:{cache_key}",
                    3600 * 24,  # 24 hours TTL
                    json.dumps(result),
                )
            except Exception as e:
                logger.warning("Cache storage failed", error=str(e))

        self._cache[cache_key] = result

    def _apply_market_shocks(
        self, portfolio_data: Dict[str, Any], shocks: List
    ) -> Dict[str, Any]:
        """Apply market shocks to portfolio data."""
        shocked_data = portfolio_data.copy()

        for shock in shocks:
            asset_class = shock.asset_class
            shock_value = shock.shock_value

            if isinstance(shock_value, dict):
                # Vector shock
                for key, value in shock_value.items():
                    field_name = f"{asset_class}_{key}"
                    if field_name in shocked_data:
                        if shock.shock_type == "relative":
                            shocked_data[field_name] *= 1 + value
                        else:
                            shocked_data[field_name] += value
            else:
                # Scalar shock
                field_name = f"{asset_class}_value"
                if field_name in shocked_data:
                    if shock.shock_type == "relative":
                        shocked_data[field_name] *= 1 + shock_value
                    else:
                        shocked_data[field_name] += shock_value

        return shocked_data

    def _execute_step(
        self, step: Any, portfolio_data: Dict[str, Any], step_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a single calculation step."""
        # Get input data from previous steps
        input_data = {}
        for input_id in step.inputs:
            if input_id in step_results:
                input_data.update(step_results[input_id])
            else:
                logger.warning(f"Missing input for step {step.step_id}: {input_id}")

        # Merge with portfolio data
        merged_data = {**portfolio_data, **input_data}

        # Execute rule if present
        if step.rule:
            result = self.rules_engine.execute_rule(step.rule, merged_data)
        else:
            # Custom step logic would go here
            result = {"status": "success", "data": merged_data}

        return result

    def execute(
        self, scenario: ScenarioDSL, portfolio_id: str, portfolio_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a scenario calculation.

        Args:
            scenario: Scenario DSL definition
            portfolio_id: Portfolio identifier
            portfolio_data: Portfolio data (if None, will be loaded)

        Returns:
            Dictionary with calculation results
        """
        # Validate scenario
        errors = scenario.validate()
        if errors:
            return {"status": "error", "errors": errors}

        # Check cache
        cache_key = self._compute_cache_key(scenario, portfolio_id)
        cached_result = self._get_from_cache(cache_key)
        if cached_result:
            logger.info("Cache hit", cache_key=cache_key[:16])
            return cached_result

        # Load portfolio data (placeholder - would integrate with data layer)
        if portfolio_data is None:
            portfolio_data = self._load_portfolio_data(portfolio_id, scenario.portfolio.as_of_date)

        # Apply market shocks
        shocked_data = self._apply_market_shocks(portfolio_data, scenario.market_shocks)

        # Execute calculation steps
        step_results: Dict[str, Any] = {}
        step_order = self._topological_sort(scenario.calculation_steps)

        for step_id in step_order:
            step = next(s for s in scenario.calculation_steps if s.step_id == step_id)
            step_result = self._execute_step(step, shocked_data, step_results)
            step_results[step_id] = step_result

        # Collect outputs
        outputs = {}
        for output_id in scenario.outputs:
            if output_id in step_results:
                outputs[output_id] = step_results[output_id]

        result = {
            "status": "success",
            "scenario_id": scenario.metadata.scenario_id,
            "portfolio_id": portfolio_id,
            "outputs": outputs,
            "all_steps": step_results,
        }

        # Store in cache
        self._store_in_cache(cache_key, result)

        return result

    def _load_portfolio_data(self, portfolio_id: str, as_of_date: Any) -> Dict[str, Any]:
        """Load portfolio data (placeholder - would integrate with data layer)."""
        # Placeholder implementation
        logger.warning("Using placeholder portfolio data", portfolio_id=portfolio_id)
        return {
            "risk_weighted_assets": 1000000.0,
            "common_equity_tier1": 50000.0,
            "high_quality_liquid_assets": 200000.0,
            "net_cash_outflows_30d": 150000.0,
        }

    def _topological_sort(self, steps: List[Any]) -> List[str]:
        """Topologically sort calculation steps by dependencies."""
        # Build dependency graph
        step_map = {step.step_id: step for step in steps}
        in_degree = {step_id: 0 for step_id in step_map}
        graph: Dict[str, List[str]] = {step_id: [] for step_id in step_map}

        for step in steps:
            for input_id in step.inputs:
                if input_id in step_map:
                    graph[input_id].append(step.step_id)
                    in_degree[step.step_id] += 1

        # Kahn's algorithm
        queue = [step_id for step_id, degree in in_degree.items() if degree == 0]
        result = []

        while queue:
            step_id = queue.pop(0)
            result.append(step_id)

            for neighbor in graph[step_id]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if len(result) != len(steps):
            raise ValueError("Circular dependency detected in calculation steps")

        return result

