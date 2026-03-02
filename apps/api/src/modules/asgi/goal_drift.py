"""Goal Drift Analyzer - detects subtle shifts in AI system objectives over time."""
import json
import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.asgi.models import GoalDriftSnapshot

logger = logging.getLogger(__name__)


class GoalDriftAnalyzer:
    """
    Detects subtle shifts in AI system objectives over time.

    Analyzes:
    - Action plan similarity across time
    - Objective function evolution
    - Constraint interpretation changes
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_historical_plans(self, system_id: str, days: int) -> list[GoalDriftSnapshot]:
        """Fetch historical drift snapshots for the system."""
        cutoff = datetime.utcnow().date() - timedelta(days=days)
        result = await self.db.execute(
            select(GoalDriftSnapshot)
            .where(
                GoalDriftSnapshot.ai_system_id == int(system_id),
                GoalDriftSnapshot.snapshot_date >= cutoff,
            )
            .order_by(GoalDriftSnapshot.snapshot_date.asc())
        )
        return list(result.scalars().all())

    def _compute_drift(self, snapshots: list[GoalDriftSnapshot]) -> float:
        """Compute drift score 0-1 from snapshots (heuristic: variance in drift_from_baseline)."""
        if len(snapshots) < 2:
            return 0.0
        vals = [s.drift_from_baseline or 0.0 for s in snapshots]
        mean = sum(vals) / len(vals)
        var = sum((x - mean) ** 2 for x in vals) / len(vals)
        return min(1.0, (var ** 0.5) * 2)

    def _detect_constraint_changes(self, snapshots: list[GoalDriftSnapshot]) -> list[dict]:
        """Detect constraint relaxations across snapshots."""
        changes = []
        for i, s in enumerate(snapshots):
            try:
                cs = json.loads(s.constraint_set or "{}")
                if isinstance(cs, dict):
                    count = len(cs.get("constraints", [])) if "constraints" in cs else 0
                    changes.append({
                        "snapshot_date": str(s.snapshot_date) if s.snapshot_date else None,
                        "constraint_count": count,
                    })
            except (json.JSONDecodeError, TypeError):
                pass
        return changes

    def _recommend(self, drift_score: float) -> str:
        """Return recommended action based on drift score."""
        if drift_score >= 0.5:
            return "PAUSE_AND_REVIEW"
        if drift_score >= 0.3:
            return "INCREASE_MONITORING"
        if drift_score >= 0.1:
            return "MONITOR"
        return "NONE"

    async def analyze_drift(self, system_id: str, days: int = 30) -> dict:
        """
        Analyze goal drift for a system.

        Returns:
            {
                "drift_score": float (0=stable, 1=complete drift),
                "constraint_relaxations": list,
                "trend": "STABLE" | "CONCERNING",
                "recommended_action": str,
            }
        """
        historical = await self._get_historical_plans(system_id, days)
        drift_score = self._compute_drift(historical)
        constraint_changes = self._detect_constraint_changes(historical)
        trend = "STABLE" if drift_score < 0.1 else "CONCERNING"
        recommended_action = self._recommend(drift_score)
        return {
            "system_id": system_id,
            "drift_score": drift_score,
            "snapshot_count": len(historical),
            "constraint_relaxations": constraint_changes,
            "trend": trend,
            "recommended_action": recommended_action,
        }
