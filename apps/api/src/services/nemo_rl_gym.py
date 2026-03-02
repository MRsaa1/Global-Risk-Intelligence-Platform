"""
NVIDIA NeMo RL & Gym integration (Phase C2).

Gym: stress_test_simulator environment — state (scenario, portfolio), actions (scenario/params),
     reward (user feedback or report metrics). Stub returns scenarios for RL.
RL: One scenario — e.g. ADVISOR policy optimization: run env + policy update (stub or NeMo RL API).
"""
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from src.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class GymState:
    """State of the stress-test simulator environment."""
    scenario_id: str
    scenario_type: str  # e.g. flood, financial_crisis
    portfolio_summary: Dict[str, Any]
    severity: float
    step: int = 0


@dataclass
class GymAction:
    """Action in the Gym (e.g. select scenario or params)."""
    action_type: str  # select_scenario | set_params | run_simulation
    payload: Dict[str, Any] = field(default_factory=dict)


@dataclass
class GymStepResult:
    """Result of one Gym step."""
    state: GymState
    reward: float
    done: bool
    info: Dict[str, Any] = field(default_factory=dict)


class StressTestGym:
    """
    Gym environment for stress-test simulation.
    Used for RL: agent (e.g. ADVISOR) chooses scenarios/params; reward from user feedback or report metrics.
    Without real NeMo Gym API: stub returns fixed scenarios and mock rewards.
    """

    def __init__(self, env_type: str = "stress_test_simulator"):
        self.env_type = env_type
        self.nemo_gym_url = getattr(settings, "nemo_gym_api_url", "") or ""
        self._scenario_types = ["flood", "heat", "drought", "financial_crisis", "pandemic"]

    def reset(self, portfolio_summary: Optional[Dict[str, Any]] = None) -> GymState:
        """Reset environment; optional initial portfolio."""
        return GymState(
            scenario_id="init",
            scenario_type="flood",
            portfolio_summary=portfolio_summary or {},
            severity=0.5,
            step=0,
        )

    def step(self, state: GymState, action: GymAction) -> GymStepResult:
        """Execute one step with composite reward function."""
        if self.nemo_gym_url:
            try:
                return self._call_gym_api(state, action)
            except Exception as e:
                logger.warning("NeMo Gym API call failed, using simulation: %s", e)

        import random
        new_step = state.step + 1
        severity = action.payload.get("severity", state.severity)
        scenario_type = action.payload.get("scenario_type", state.scenario_type)

        # Composite reward: risk reduction + ROI + diversity bonus
        base_risk = severity * 0.8
        risk_reduction = max(0, base_risk - random.uniform(0, severity * 0.3))
        roi_signal = random.uniform(0.05, 0.15) * (1 - severity)
        diversity_bonus = 0.05 if scenario_type != state.scenario_type else 0.0
        coverage_bonus = 0.02 * min(new_step, 5)

        reward = risk_reduction * 0.4 + roi_signal * 0.3 + diversity_bonus * 0.2 + coverage_bonus * 0.1

        # Update portfolio summary with simulation effects
        portfolio = dict(state.portfolio_summary)
        portfolio["cumulative_risk_reduction"] = portfolio.get("cumulative_risk_reduction", 0) + risk_reduction
        portfolio["scenarios_tested"] = portfolio.get("scenarios_tested", 0) + 1
        portfolio["last_severity"] = severity

        done = new_step >= 10
        new_state = GymState(
            scenario_id=f"{scenario_type}_{new_step}",
            scenario_type=scenario_type,
            portfolio_summary=portfolio,
            severity=severity,
            step=new_step,
        )
        return GymStepResult(
            state=new_state,
            reward=round(reward, 4),
            done=done,
            info={
                "risk_reduction": round(risk_reduction, 4),
                "roi_signal": round(roi_signal, 4),
                "diversity_bonus": diversity_bonus,
                "coverage_bonus": round(coverage_bonus, 4),
            },
        )

    def _call_gym_api(self, state: GymState, action: GymAction) -> GymStepResult:
        """Call real NeMo Gym API when available."""
        import httpx
        url = f"{self.nemo_gym_url.rstrip('/')}/v1/step"
        payload = {
            "state": {
                "scenario_id": state.scenario_id,
                "scenario_type": state.scenario_type,
                "portfolio_summary": state.portfolio_summary,
                "severity": state.severity,
                "step": state.step,
            },
            "action": {"action_type": action.action_type, "payload": action.payload},
        }
        with httpx.Client(timeout=60.0) as client:
            r = client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
        s = data.get("state", {})
        new_state = GymState(
            scenario_id=s.get("scenario_id", state.scenario_id),
            scenario_type=s.get("scenario_type", state.scenario_type),
            portfolio_summary=s.get("portfolio_summary", state.portfolio_summary),
            severity=s.get("severity", state.severity),
            step=s.get("step", state.step + 1),
        )
        return GymStepResult(
            state=new_state,
            reward=float(data.get("reward", 0)),
            done=bool(data.get("done", False)),
            info=data.get("info", {}),
        )

    def generate_scenarios(
        self,
        count: int = 100,
        types: Optional[List[str]] = None,
        severity_range: Tuple[float, float] = (0.3, 1.0),
    ) -> List[Dict[str, Any]]:
        """Generate training scenarios. Stub: return list of scenario descriptors."""
        types = types or self._scenario_types
        scenarios = []
        for i in range(count):
            t = types[i % len(types)]
            lo, hi = severity_range
            severity = lo + (hi - lo) * (i / max(count, 1))
            scenarios.append({
                "id": f"gym_{t}_{i}",
                "type": t,
                "severity": min(hi, severity),
                "name": f"{t} scenario {i}",
            })
        return scenarios


@dataclass
class RLExperimentResult:
    """Result of one RL experiment (e.g. ADVISOR policy optimization)."""
    experiment_id: str
    status: str  # completed | failed | mock
    policy_version: Optional[str] = None
    episodes: int = 0
    avg_reward: float = 0.0
    message: str = ""


class NeMoRLService:
    """
    NeMo RL: one scenario — e.g. optimize ADVISOR policy using Gym.
    Runs environment steps and policy update (stub or NeMo RL API).
    """

    def __init__(self):
        self.nemo_rl_url = getattr(settings, "nemo_rl_api_url", "") or ""
        self.gym = StressTestGym()

    def run_advisor_policy_experiment(
        self,
        episodes: int = 100,
        reward_signals: Optional[List[str]] = None,
    ) -> RLExperimentResult:
        """
        One RL scenario: ADVISOR policy optimization.
        Uses StressTestGym for rollouts; updates policy via NeMo RL API or stub.
        """
        reward_signals = reward_signals or ["user_feedback", "report_quality"]
        if self.nemo_rl_url:
            try:
                return self._call_rl_api(episodes, reward_signals)
            except Exception as e:
                logger.warning("NeMo RL API call failed, using stub: %s", e)
        # Stub: run a few gym steps and return mock result
        state = self.gym.reset()
        total_reward = 0.0
        steps = 0
        for _ in range(min(episodes, 20)):
            action = GymAction("run_simulation", {"severity": 0.5, "scenario_type": "flood"})
            result = self.gym.step(state, action)
            total_reward += result.reward
            state = result.state
            steps += 1
            if result.done:
                state = self.gym.reset(state.portfolio_summary)
        avg = total_reward / max(steps, 1)
        logger.info("NeMo RL stub: ADVISOR policy experiment, episodes=%s, avg_reward=%s", episodes, avg)
        return RLExperimentResult(
            experiment_id="mock_rl_advisor_1",
            status="mock",
            policy_version="mock_policy_v1",
            episodes=episodes,
            avg_reward=avg,
            message="RL stub; set NEMO_RL_API_URL for real NeMo RL API.",
        )

    def _call_rl_api(self, episodes: int, reward_signals: List[str]) -> RLExperimentResult:
        """Call real NeMo RL API when available."""
        import httpx
        url = f"{self.nemo_rl_url.rstrip('/')}/v1/experiment"
        payload = {"agent": "ADVISOR", "episodes": episodes, "reward_signals": reward_signals}
        with httpx.Client(timeout=600.0) as client:
            r = client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
        return RLExperimentResult(
            experiment_id=data.get("experiment_id", "rl_1"),
            status=data.get("status", "completed"),
            policy_version=data.get("policy_version"),
            episodes=data.get("episodes", episodes),
            avg_reward=float(data.get("avg_reward", 0)),
            message=data.get("message", "OK"),
        )


# Singletons for import
stress_test_gym = StressTestGym()
nemo_rl_service = NeMoRLService()
