"""
Audit Logging for SRO (Phase 1.3).

Immutable audit trail for simulations and decisions.
Tamper detection via hash.
"""
import hashlib
import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


def _compute_hash(scenario: Any, results: Any) -> str:
    """Compute SHA-256 hash for tamper detection."""
    payload = json.dumps(
        {"scenario": scenario, "results": results},
        default=str,
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


class AuditLogger:
    """
    Immutable audit trail for regulatory compliance.
    """

    def __init__(self, db_session=None):
        self.db = db_session

    async def log_simulation(
        self,
        scenario: Dict[str, Any],
        results: Dict[str, Any],
        user_id: Optional[str] = None,
        user_role: Optional[str] = None,
        decisions: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Record simulation run for audit.
        Returns log entry ID.
        """
        log_hash = _compute_hash(scenario, results)
        log_id = str(uuid4())

        if self.db:
            try:
                from src.modules.sro.models import AuditLog

                entry = AuditLog(
                    id=log_id,
                    log_hash=log_hash,
                    action_type="SIMULATION_RUN",
                    scenario_id=scenario.get("id"),
                    scenario_snapshot=json.dumps(scenario, default=str),
                    results_snapshot=json.dumps(results, default=str),
                    decisions_snapshot=json.dumps(decisions or {}, default=str),
                    user_id=user_id,
                    user_role=user_role,
                )
                self.db.add(entry)
                await self.db.flush()
                logger.info("SRO audit: logged simulation %s", log_id)
            except Exception as e:
                logger.warning("SRO audit log_simulation failed: %s", e)

        return log_id

    async def log_dashboard_action(
        self,
        action: str,
        endpoint: str,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Log dashboard action (heatmap view, scenario load, optimize, etc.).
        Returns log entry ID or None.
        """
        log_id = str(uuid4())
        if self.db:
            try:
                from src.modules.sro.models import AuditLog

                snap = {"action": action, "endpoint": endpoint}
                meta = metadata or {}
                log_hash = _compute_hash(snap, meta)
                entry = AuditLog(
                    id=log_id,
                    log_hash=log_hash,
                    action_type="DASHBOARD_ACTION",
                    scenario_id=None,
                    scenario_snapshot=json.dumps(snap, default=str),
                    results_snapshot=json.dumps(meta, default=str),
                    decisions_snapshot="{}",
                    user_id=user_id,
                    user_role=None,
                )
                self.db.add(entry)
                await self.db.flush()
            except Exception as e:
                logger.warning("SRO audit log_dashboard_action failed: %s", e)
        return log_id

    async def verify_audit_trail(self) -> bool:
        """
        Verify integrity of audit trail (no tampering).
        """
        if not self.db:
            return True
        try:
            from sqlalchemy import select
            from src.modules.sro.models import AuditLog

            result = await self.db.execute(select(AuditLog))
            entries = list(result.scalars().all())
            for entry in entries:
                scenario = json.loads(entry.scenario_snapshot or "{}")
                results = json.loads(entry.results_snapshot or "{}")
                expected = _compute_hash(scenario, results)
                if entry.log_hash != expected:
                    logger.error("Audit trail tampered: entry %s", entry.id)
                    return False
            return True
        except Exception as e:
            logger.warning("SRO audit verify failed: %s", e)
            return False


def get_audit_logger(db_session=None) -> AuditLogger:
    """Factory for audit logger."""
    return AuditLogger(db_session)
