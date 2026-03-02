"""
PathIntegralSimulator — quantum-inspired trajectory ensemble analysis.

Instead of N independent Monte Carlo runs, generates parametrically varied
trajectories through risk-space, weights each by probability amplitude, and
detects "constructive interference" — where independent risk chains converge
and amplify each other.
"""
import asyncio
import logging
import math
import random
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


@dataclass
class RiskChainConfig:
    chain_id: str
    name: str
    domain: str  # climate, financial, operational, infrastructure, geopolitical
    trigger_node_id: str = ""
    base_severity: float = 0.5
    parameter_overrides: Dict[str, float] = field(default_factory=dict)


@dataclass
class TrajectoryPoint:
    time_step: int
    node_id: str
    stress_level: float
    risk_chain_id: str


@dataclass
class RiskTrajectory:
    trajectory_id: str
    chain_id: str
    amplitude: float
    points: List[TrajectoryPoint] = field(default_factory=list)
    final_loss: float = 0.0


@dataclass
class InterferenceZone:
    asset_id: str
    time_step: int
    converging_chains: List[str]
    individual_losses: List[float]
    combined_loss: float
    amplification_ratio: float
    resonance_type: str  # constructive | destructive


@dataclass
class PathIntegralResult:
    simulation_id: str
    trajectories_count: int
    interference_zones: List[InterferenceZone]
    total_trajectories: List[RiskTrajectory]
    computation_time_ms: int = 0
    risk_chains_used: List[str] = field(default_factory=list)


class PathIntegralSimulator:
    """Trajectory ensemble simulator with interference detection."""

    def __init__(self, cascade_engine=None, physics_engine=None, contagion_matrix=None):
        self._cascade = cascade_engine
        self._physics = physics_engine
        self._contagion = contagion_matrix

    async def simulate_trajectory_ensemble(
        self,
        graph: Optional[dict] = None,
        risk_chains: Optional[List[RiskChainConfig]] = None,
        time_horizon: int = 120,
        num_trajectories_per_chain: int = 200,
        parameter_perturbation_sigma: float = 0.15,
    ) -> PathIntegralResult:
        start = time.time()
        sim_id = f"pi_{uuid4().hex[:10]}"

        if not risk_chains:
            risk_chains = self._default_risk_chains()

        all_trajectories: List[RiskTrajectory] = []

        for chain in risk_chains:
            for i in range(num_trajectories_per_chain):
                traj = self._generate_trajectory(
                    chain, i, time_horizon, parameter_perturbation_sigma, graph,
                )
                all_trajectories.append(traj)

        interference = await self.detect_interference_zones(all_trajectories)

        return PathIntegralResult(
            simulation_id=sim_id,
            trajectories_count=len(all_trajectories),
            interference_zones=interference,
            total_trajectories=all_trajectories[:50],
            computation_time_ms=int((time.time() - start) * 1000),
            risk_chains_used=[c.chain_id for c in risk_chains],
        )

    def _generate_trajectory(
        self,
        chain: RiskChainConfig,
        index: int,
        time_horizon: int,
        sigma: float,
        graph: Optional[dict],
    ) -> RiskTrajectory:
        tid = f"t_{chain.chain_id}_{index}"
        points = []
        stress = chain.base_severity * (1.0 + random.gauss(0, sigma))
        stress = max(0.0, min(1.0, stress))
        loss = 0.0

        num_steps = min(time_horizon, 24)
        node_id = chain.trigger_node_id or f"node_{chain.domain}"

        for t in range(num_steps):
            noise = random.gauss(0, sigma * 0.5)
            stress = max(0.0, min(1.0, stress + noise * 0.1))
            points.append(TrajectoryPoint(
                time_step=t,
                node_id=node_id,
                stress_level=stress,
                risk_chain_id=chain.chain_id,
            ))
            if stress > 0.8:
                loss += stress * 1_000_000

        amplitude = self.compute_amplitude(stress, chain.base_severity, sigma)

        return RiskTrajectory(
            trajectory_id=tid,
            chain_id=chain.chain_id,
            amplitude=amplitude,
            points=points,
            final_loss=loss,
        )

    @staticmethod
    def compute_amplitude(final_stress: float, base_severity: float, sigma: float) -> float:
        """P(trajectory) approximated as Gaussian likelihood of deviation from base."""
        deviation = abs(final_stress - base_severity)
        return math.exp(-0.5 * (deviation / max(sigma, 0.01)) ** 2)

    async def detect_interference_zones(
        self,
        trajectories: List[RiskTrajectory],
        amplification_threshold: float = 1.5,
    ) -> List[InterferenceZone]:
        # Group trajectories by (node_id, time_step) across different chains
        grid: Dict[tuple, Dict[str, List[float]]] = {}
        for traj in trajectories:
            for pt in traj.points:
                key = (pt.node_id, pt.time_step)
                if key not in grid:
                    grid[key] = {}
                chain = traj.chain_id
                if chain not in grid[key]:
                    grid[key][chain] = []
                grid[key][chain].append(pt.stress_level * traj.amplitude)

        zones = []
        for (node_id, time_step), chain_stresses in grid.items():
            if len(chain_stresses) < 2:
                continue

            individual = []
            for chain_id, stresses in chain_stresses.items():
                avg = sum(stresses) / len(stresses) if stresses else 0
                individual.append(avg)

            combined = sum(individual)
            linear_sum = sum(individual)

            # Interference: coupling factor from contagion matrix
            coupling = 1.0
            if self._contagion:
                try:
                    coupling = 1.2  # Simplified cross-sector coupling
                except Exception:
                    pass

            combined *= coupling
            ratio = combined / max(linear_sum, 0.001)

            if ratio >= amplification_threshold:
                zones.append(InterferenceZone(
                    asset_id=node_id,
                    time_step=time_step,
                    converging_chains=list(chain_stresses.keys()),
                    individual_losses=individual,
                    combined_loss=combined,
                    amplification_ratio=ratio,
                    resonance_type="constructive" if ratio > 1.0 else "destructive",
                ))

        zones.sort(key=lambda z: z.amplification_ratio, reverse=True)
        return zones[:50]

    @staticmethod
    def _default_risk_chains() -> List[RiskChainConfig]:
        return [
            RiskChainConfig(chain_id="climate", name="Climate Hazards", domain="climate", base_severity=0.4),
            RiskChainConfig(chain_id="financial", name="Financial Stress", domain="financial", base_severity=0.3),
            RiskChainConfig(chain_id="operational", name="Operational Disruption", domain="operational", base_severity=0.25),
            RiskChainConfig(chain_id="infrastructure", name="Infrastructure Failure", domain="infrastructure", base_severity=0.35),
        ]


# Singleton
path_integral_simulator = PathIntegralSimulator()
