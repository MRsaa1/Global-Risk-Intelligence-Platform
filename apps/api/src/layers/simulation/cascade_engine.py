"""
Cascade Simulation Engine.

Monte Carlo simulation of cascade failures through the network.
Key differentiator: Models hidden risk multipliers from dependencies.
"""
import logging
import random
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class CascadeStep:
    """A single step in the cascade propagation."""
    time_step: int
    node_id: str
    node_name: str
    node_type: str
    impact_factor: float
    stress_level: float
    failed: bool
    exposure: float


@dataclass
class CascadeRunResult:
    """Result of a single Monte Carlo run."""
    run_id: int
    triggered_failures: list[str]
    total_exposure: float
    max_cascade_depth: int
    steps: list[CascadeStep]


@dataclass
class CascadeSimulationResult:
    """Aggregate result of cascade simulation."""
    simulation_id: UUID
    trigger_event: str
    trigger_node_id: str
    
    # Monte Carlo results
    num_runs: int
    
    # Exposure statistics
    mean_exposure: float
    median_exposure: float
    percentile_95_exposure: float
    percentile_99_exposure: float
    max_exposure: float
    
    # Failure statistics
    mean_failures: float
    max_failures: int
    failure_probability_by_node: dict
    
    # Hidden risk
    direct_exposure: float
    hidden_risk_multiplier: float
    
    # Timeline (average cascade)
    average_timeline: list[dict]
    
    # Metadata
    simulated_at: datetime
    computation_time_ms: int


class CascadeEngine:
    """
    Monte Carlo Cascade Simulation Engine.
    
    Simulates how failures propagate through the dependency network.
    Reveals hidden risk not visible in traditional models.
    
    Algorithm:
    1. Apply trigger event to initial node
    2. Propagate stress through dependency graph
    3. Check failure thresholds at each node
    4. Continue until no new failures
    5. Repeat for N Monte Carlo runs
    6. Aggregate statistics
    """
    
    def __init__(self, default_runs: int = 1000):
        self.default_runs = default_runs
    
    async def simulate(
        self,
        trigger_node_id: str,
        trigger_severity: float = 1.0,  # 0-1
        graph: Optional[dict] = None,
        num_runs: int = None,
        time_horizon: int = 12,  # time steps
        failure_threshold: float = 0.8,
        recovery_rate: float = 0.1,
    ) -> CascadeSimulationResult:
        """
        Run Monte Carlo cascade simulation.
        
        Args:
            trigger_node_id: ID of the initially failing node
            trigger_severity: Severity of the trigger event (0-1)
            graph: Dependency graph (nodes and edges with criticality)
            num_runs: Number of Monte Carlo runs
            time_horizon: Maximum time steps to simulate
            failure_threshold: Stress level that triggers failure
            recovery_rate: Rate at which stress decreases
            
        Returns:
            CascadeSimulationResult with statistics
        """
        import time
        start_time = time.time()
        
        num_runs = num_runs or self.default_runs
        
        # Use provided graph or create sample
        if graph is None:
            graph = self._create_sample_graph(trigger_node_id)
        
        # Get direct exposure (for hidden risk calculation)
        direct_exposure = self._get_direct_exposure(graph, trigger_node_id)
        
        # Run Monte Carlo simulation
        all_runs = []
        for run_id in range(num_runs):
            run_result = await self._run_single_cascade(
                run_id=run_id,
                trigger_node_id=trigger_node_id,
                trigger_severity=trigger_severity,
                graph=graph,
                time_horizon=time_horizon,
                failure_threshold=failure_threshold,
                recovery_rate=recovery_rate,
            )
            all_runs.append(run_result)
        
        # Aggregate results
        exposures = [r.total_exposure for r in all_runs]
        failure_counts = [len(r.triggered_failures) for r in all_runs]
        
        # Calculate failure probability by node
        failure_counts_by_node = {}
        for run in all_runs:
            for node_id in run.triggered_failures:
                failure_counts_by_node[node_id] = failure_counts_by_node.get(node_id, 0) + 1
        
        failure_prob = {
            node_id: count / num_runs
            for node_id, count in failure_counts_by_node.items()
        }
        
        # Calculate average timeline
        avg_timeline = self._calculate_average_timeline(all_runs)
        
        # Calculate hidden risk multiplier
        mean_exposure = np.mean(exposures)
        hidden_multiplier = mean_exposure / direct_exposure if direct_exposure > 0 else 1.0
        
        computation_time = int((time.time() - start_time) * 1000)
        
        return CascadeSimulationResult(
            simulation_id=uuid4(),
            trigger_event=f"Failure of {trigger_node_id}",
            trigger_node_id=trigger_node_id,
            num_runs=num_runs,
            mean_exposure=mean_exposure,
            median_exposure=float(np.median(exposures)),
            percentile_95_exposure=float(np.percentile(exposures, 95)),
            percentile_99_exposure=float(np.percentile(exposures, 99)),
            max_exposure=max(exposures),
            mean_failures=np.mean(failure_counts),
            max_failures=max(failure_counts),
            failure_probability_by_node=failure_prob,
            direct_exposure=direct_exposure,
            hidden_risk_multiplier=max(1.0, hidden_multiplier),
            average_timeline=avg_timeline,
            simulated_at=datetime.utcnow(),
            computation_time_ms=computation_time,
        )
    
    async def _run_single_cascade(
        self,
        run_id: int,
        trigger_node_id: str,
        trigger_severity: float,
        graph: dict,
        time_horizon: int,
        failure_threshold: float,
        recovery_rate: float,
    ) -> CascadeRunResult:
        """Run a single Monte Carlo cascade."""
        nodes = graph["nodes"]
        edges = graph["edges"]
        
        # Initialize node states
        node_stress = {node_id: 0.0 for node_id in nodes}
        node_failed = {node_id: False for node_id in nodes}
        
        # Apply trigger
        node_stress[trigger_node_id] = trigger_severity
        node_failed[trigger_node_id] = True
        
        triggered_failures = [trigger_node_id]
        steps = []
        max_depth = 0
        
        # Build reverse adjacency (who depends on whom)
        dependents = {}  # node -> list of nodes that depend on it
        for edge in edges:
            source = edge["source"]
            target = edge["target"]
            if target not in dependents:
                dependents[target] = []
            dependents[target].append({
                "node": source,
                "criticality": edge.get("criticality", 0.5),
            })
        
        # Simulate cascade
        for t in range(time_horizon):
            new_failures = []
            
            # Propagate stress from failed nodes
            for failed_node in triggered_failures:
                if failed_node in dependents:
                    for dep in dependents[failed_node]:
                        dep_node = dep["node"]
                        criticality = dep["criticality"]
                        
                        if not node_failed[dep_node]:
                            # Add stress based on criticality
                            # Higher criticality = more stress transferred
                            stress_transfer = trigger_severity * criticality * (1 + random.gauss(0, 0.1))
                            node_stress[dep_node] += stress_transfer
                            
                            # Check failure threshold
                            if node_stress[dep_node] >= failure_threshold:
                                node_failed[dep_node] = True
                                new_failures.append(dep_node)
                                max_depth = max(max_depth, t + 1)
                                
                                node_info = nodes.get(dep_node, {})
                                steps.append(CascadeStep(
                                    time_step=t + 1,
                                    node_id=dep_node,
                                    node_name=node_info.get("name", dep_node),
                                    node_type=node_info.get("type", "unknown"),
                                    impact_factor=criticality,
                                    stress_level=node_stress[dep_node],
                                    failed=True,
                                    exposure=node_info.get("exposure", 0),
                                ))
            
            # Add new failures to triggered list
            triggered_failures.extend(new_failures)
            
            # Apply recovery to non-failed nodes
            for node_id in nodes:
                if not node_failed[node_id]:
                    node_stress[node_id] = max(0, node_stress[node_id] - recovery_rate)
            
            # Check for cascade completion
            if not new_failures and all(
                node_stress[n] < failure_threshold
                for n in nodes
                if not node_failed[n]
            ):
                break
        
        # Calculate total exposure
        total_exposure = sum(
            nodes[node_id].get("exposure", 0)
            for node_id in triggered_failures
        )
        
        return CascadeRunResult(
            run_id=run_id,
            triggered_failures=triggered_failures,
            total_exposure=total_exposure,
            max_cascade_depth=max_depth,
            steps=steps,
        )
    
    def _get_direct_exposure(self, graph: dict, trigger_node_id: str) -> float:
        """Get direct exposure (without cascade)."""
        nodes = graph.get("nodes", {})
        if trigger_node_id in nodes:
            return nodes[trigger_node_id].get("exposure", 0)
        return 0
    
    def _calculate_average_timeline(self, runs: list[CascadeRunResult]) -> list[dict]:
        """Calculate average cascade timeline."""
        timeline_by_step = {}
        
        for run in runs:
            for step in run.steps:
                t = step.time_step
                if t not in timeline_by_step:
                    timeline_by_step[t] = {
                        "failures": [],
                        "exposures": [],
                    }
                timeline_by_step[t]["failures"].append(1)
                timeline_by_step[t]["exposures"].append(step.exposure)
        
        avg_timeline = []
        for t in sorted(timeline_by_step.keys()):
            data = timeline_by_step[t]
            avg_timeline.append({
                "time_step": t,
                "avg_new_failures": len(data["failures"]) / len(runs),
                "avg_exposure": sum(data["exposures"]) / max(1, len(data["exposures"])),
                "total_runs_with_failure": len(data["failures"]),
            })
        
        return avg_timeline
    
    def _create_sample_graph(self, trigger_node_id: str) -> dict:
        """Create a sample dependency graph for testing."""
        # Sample infrastructure and assets
        nodes = {
            trigger_node_id: {
                "name": "Power Grid Sector 7",
                "type": "infrastructure",
                "exposure": 50_000_000,
            },
            "asset_1": {
                "name": "Munich Office Tower",
                "type": "asset",
                "exposure": 120_000_000,
            },
            "asset_2": {
                "name": "Munich Data Center",
                "type": "asset",
                "exposure": 85_000_000,
            },
            "asset_3": {
                "name": "Industrial Complex A",
                "type": "asset",
                "exposure": 45_000_000,
            },
            "telecom_1": {
                "name": "Telecom Hub Central",
                "type": "infrastructure",
                "exposure": 30_000_000,
            },
            "asset_4": {
                "name": "Retail Center B",
                "type": "asset",
                "exposure": 35_000_000,
            },
            "asset_5": {
                "name": "Logistics Hub",
                "type": "asset",
                "exposure": 25_000_000,
            },
        }
        
        # Dependencies (source DEPENDS_ON target)
        edges = [
            {"source": "asset_1", "target": trigger_node_id, "criticality": 0.9},
            {"source": "asset_2", "target": trigger_node_id, "criticality": 0.95},
            {"source": "asset_3", "target": trigger_node_id, "criticality": 0.7},
            {"source": "telecom_1", "target": trigger_node_id, "criticality": 0.8},
            {"source": "asset_4", "target": "telecom_1", "criticality": 0.6},
            {"source": "asset_5", "target": "asset_3", "criticality": 0.5},
            {"source": "asset_5", "target": "telecom_1", "criticality": 0.4},
        ]
        
        return {"nodes": nodes, "edges": edges}


# Global engine instance
cascade_engine = CascadeEngine()
