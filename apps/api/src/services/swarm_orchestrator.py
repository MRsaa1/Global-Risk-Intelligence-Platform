"""
SwarmOrchestrator — particle-observer architecture for risk analysis.

Deploys a swarm of lightweight particle-agents that independently probe
different trajectory branches in parallel. An observer aggregates results,
identifies convergence/collapse points, and compresses the high-dimensional
state via SVD decomposition.
"""
import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class ParticleResult:
    particle_id: str
    trajectory_id: str
    key_findings: List[str] = field(default_factory=list)
    risk_hotspots: List[Tuple[str, int, float]] = field(default_factory=list)
    final_loss: float = 0.0


@dataclass
class ConvergencePoint:
    asset_id: str
    time_step: int
    num_particles_converged: int
    total_particles: int
    convergence_ratio: float
    mean_severity: float
    severity_spread: float


@dataclass
class SwarmResult:
    swarm_id: str
    convergence_points: List[ConvergencePoint]
    state_matrix_shape: Tuple[int, int] = (0, 0)
    explained_variance: float = 0.0
    top_principal_components: List[Dict[str, Any]] = field(default_factory=list)
    black_swans: List[Dict[str, Any]] = field(default_factory=list)
    computation_time_ms: int = 0
    num_particles: int = 0


class SwarmOrchestrator:
    """Parallel particle swarm analysis with observer convergence detection."""

    def __init__(
        self,
        cascade_engine=None,
        path_integral=None,
        tunneling_detector=None,
        llm_service=None,
    ):
        self._cascade = cascade_engine
        self._path_integral = path_integral
        self._tunneling = tunneling_detector
        self._llm = llm_service

    async def deploy_swarm(
        self,
        graph: Optional[dict] = None,
        num_particles: int = 50,
        time_horizon: int = 120,
        parameter_space: Optional[dict] = None,
    ) -> SwarmResult:
        start = time.time()
        swarm_id = f"swarm_{uuid4().hex[:10]}"

        # Generate parameter sets via Latin Hypercube sampling
        param_sets = self._latin_hypercube_sample(num_particles, parameter_space)

        # Run particles in parallel
        particle_results = await self._run_particles(param_sets, graph, time_horizon)

        # Observer: identify convergence
        convergence = await self.observe_convergence(particle_results)

        # Compress state matrix via SVD
        state_matrix = self._build_state_matrix(particle_results, time_horizon)
        compressed, components, variance = self.compress_state_matrix(state_matrix)

        # Flag divergent particles as black swans
        black_swans = self._detect_black_swans(particle_results)

        # LLM interpretation of principal components
        interpreted = []
        if components and self._llm:
            try:
                interpreted = await self.interpret_components(
                    np.array([c["loadings"][:10] for c in components[:3]]),
                    asset_names=[f"asset_{i}" for i in range(min(10, state_matrix.shape[1] if state_matrix.size else 0))],
                )
            except Exception:
                pass

        return SwarmResult(
            swarm_id=swarm_id,
            convergence_points=convergence,
            state_matrix_shape=state_matrix.shape if state_matrix.size else (0, 0),
            explained_variance=variance,
            top_principal_components=interpreted or components[:5],
            black_swans=black_swans,
            computation_time_ms=int((time.time() - start) * 1000),
            num_particles=num_particles,
        )

    async def _run_particles(
        self,
        param_sets: List[dict],
        graph: Optional[dict],
        time_horizon: int,
    ) -> List[ParticleResult]:
        results = []
        # Run in parallel batches
        batch_size = 10
        for i in range(0, len(param_sets), batch_size):
            batch = param_sets[i:i + batch_size]
            tasks = [self._run_single_particle(j + i, params, graph, time_horizon) for j, params in enumerate(batch)]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            for r in batch_results:
                if isinstance(r, ParticleResult):
                    results.append(r)
        return results

    async def _run_single_particle(
        self,
        index: int,
        params: dict,
        graph: Optional[dict],
        time_horizon: int,
    ) -> ParticleResult:
        pid = f"p_{index:04d}"
        np.random.seed(index)

        severity = params.get("severity", 0.5)
        noise = np.random.normal(0, 0.1)
        final_loss = max(0, (severity + noise) * 1_000_000)

        hotspots = []
        findings = []
        if severity > 0.7:
            hotspots.append(("critical_node", int(time_horizon * 0.3), severity))
            findings.append(f"High-severity trajectory (s={severity:.2f})")
        if severity > 0.9:
            findings.append("Potential black swan trajectory")

        return ParticleResult(
            particle_id=pid,
            trajectory_id=f"traj_{pid}",
            key_findings=findings,
            risk_hotspots=hotspots,
            final_loss=final_loss,
        )

    async def observe_convergence(
        self,
        particle_results: List[ParticleResult],
        convergence_threshold: float = 0.3,
    ) -> List[ConvergencePoint]:
        """Identify convergence points across particles."""
        if not particle_results:
            return []

        # Group hotspots by (asset_id, time_step)
        grid: Dict[Tuple[str, int], List[float]] = {}
        for pr in particle_results:
            for asset_id, ts, sev in pr.risk_hotspots:
                key = (asset_id, ts)
                if key not in grid:
                    grid[key] = []
                grid[key].append(sev)

        total = len(particle_results)
        points = []
        for (asset_id, ts), severities in grid.items():
            ratio = len(severities) / total
            if ratio >= convergence_threshold:
                mean_sev = float(np.mean(severities))
                spread = float(np.std(severities))
                points.append(ConvergencePoint(
                    asset_id=asset_id,
                    time_step=ts,
                    num_particles_converged=len(severities),
                    total_particles=total,
                    convergence_ratio=round(ratio, 3),
                    mean_severity=round(mean_sev, 4),
                    severity_spread=round(spread, 4),
                ))

        points.sort(key=lambda p: p.convergence_ratio, reverse=True)
        return points

    def compress_state_matrix(
        self,
        state_matrix: np.ndarray,
        retain_variance: float = 0.95,
    ) -> Tuple[np.ndarray, List[dict], float]:
        """SVD decomposition for state compression."""
        if state_matrix.size == 0 or state_matrix.shape[0] < 2:
            return np.array([]), [], 0.0

        try:
            U, S, Vt = np.linalg.svd(state_matrix, full_matrices=False)
            total_var = np.sum(S ** 2)
            cumulative = np.cumsum(S ** 2) / total_var

            n_components = int(np.searchsorted(cumulative, retain_variance) + 1)
            n_components = min(n_components, len(S))
            explained = float(cumulative[n_components - 1]) if n_components > 0 else 0.0

            components = []
            for i in range(min(n_components, 5)):
                components.append({
                    "component_index": i,
                    "explained_variance_ratio": round(float(S[i] ** 2 / total_var), 4),
                    "singular_value": round(float(S[i]), 4),
                    "loadings": Vt[i].tolist(),
                })

            compressed = U[:, :n_components] @ np.diag(S[:n_components])
            return compressed, components, explained
        except Exception as exc:
            logger.debug("SVD failed: %s", exc)
            return np.array([]), [], 0.0

    async def interpret_components(
        self,
        components: np.ndarray,
        asset_names: List[str],
    ) -> List[dict]:
        """LLM interprets principal components."""
        if self._llm is None or components.size == 0:
            return []

        interpreted = []
        for i in range(min(len(components), 3)):
            loadings = components[i]
            top_indices = np.argsort(np.abs(loadings))[::-1][:5]
            top_assets = [(asset_names[j] if j < len(asset_names) else f"dim_{j}", float(loadings[j]))
                          for j in top_indices]

            try:
                prompt = (f"Principal component {i + 1} of risk analysis loads on: "
                          f"{top_assets}. What risk factor does this represent? 1-2 sentences.")
                resp = await self._llm.generate(prompt=prompt, max_tokens=128, temperature=0.4)
                interpreted.append({
                    "component_index": i,
                    "top_loadings": top_assets,
                    "interpretation": resp.content,
                })
            except Exception:
                interpreted.append({"component_index": i, "top_loadings": top_assets, "interpretation": ""})

        return interpreted

    def _build_state_matrix(
        self,
        particle_results: List[ParticleResult],
        time_horizon: int,
    ) -> np.ndarray:
        """Build (num_particles x features) state matrix from particle results."""
        if not particle_results:
            return np.array([])

        rows = []
        for pr in particle_results:
            row = [pr.final_loss, len(pr.risk_hotspots), len(pr.key_findings)]
            for _, _, sev in pr.risk_hotspots[:5]:
                row.append(sev)
            while len(row) < 8:
                row.append(0.0)
            rows.append(row[:8])

        return np.array(rows)

    def _detect_black_swans(self, particle_results: List[ParticleResult]) -> List[dict]:
        """Flag divergent particles as potential black swans."""
        if not particle_results:
            return []
        losses = [pr.final_loss for pr in particle_results]
        mean_loss = np.mean(losses)
        std_loss = np.std(losses) if len(losses) > 1 else 0

        swans = []
        for pr in particle_results:
            if std_loss > 0 and (pr.final_loss - mean_loss) / std_loss > 2.5:
                swans.append({
                    "particle_id": pr.particle_id,
                    "final_loss": round(pr.final_loss, 2),
                    "z_score": round((pr.final_loss - mean_loss) / std_loss, 2),
                    "findings": pr.key_findings,
                })

        swans.sort(key=lambda s: s["z_score"], reverse=True)
        return swans[:10]

    @staticmethod
    def _latin_hypercube_sample(n: int, space: Optional[dict] = None) -> List[dict]:
        """Generate Latin Hypercube samples for parameter coverage."""
        if not space:
            space = {"severity": (0.1, 0.95), "recovery_rate": (0.05, 0.3)}

        samples = []
        dims = list(space.keys())
        for i in range(n):
            sample = {}
            for dim in dims:
                lo, hi = space[dim]
                segment = (i + np.random.random()) / n
                sample[dim] = lo + segment * (hi - lo)
            samples.append(sample)

        # Shuffle each dimension independently
        for dim in dims:
            vals = [s[dim] for s in samples]
            np.random.shuffle(vals)
            for j, s in enumerate(samples):
                s[dim] = vals[j]

        return samples


# Singleton
swarm_orchestrator = SwarmOrchestrator()
