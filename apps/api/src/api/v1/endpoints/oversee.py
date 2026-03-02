"""
OVERSEER API - System-wide monitoring AI.

GET /status: last snapshot, system_alerts, executive_summary.
POST /run: trigger one oversee cycle manually. When ALLOW_SEED_IN_PRODUCTION=true, allowed without auth (for dashboard on server); otherwise requires auth + ADMIN.
GET /circuit-breakers: get all circuit breaker states.
POST /circuit-breakers/{name}/reset: reset a circuit breaker (requires auth + ADMIN).
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.config import settings
from src.core.security import get_current_user, get_current_user_optional
from src.models.user import User, UserRole
from src.services.oversee import get_oversee_service
from src.core.resilience.circuit_breaker import get_circuit_breaker, get_all_circuit_breakers

router = APIRouter()
logger = logging.getLogger(__name__)

FALLBACK_OVERSEER_STATUS = {
    "snapshot": None,
    "timestamp": None,
    "checks": {},
    "system_alerts": [],
    "executive_summary": "Overseer not yet run. Run POST /oversee/run to collect status.",
    "executive_summary_sources": [],
    "databases": {},
    "services": {},
    "modules": {},
    "agents": {},
    "endpoints": {},
    "nvidia": {},
    "performance": {},
    "auto_resolution_actions": [],
    "circuit_breakers": [],
}


@router.get("/status")
async def get_oversee_status():
    """
    Get last OVERSEER status: health checks, system_alerts, executive_summary.
    """
    try:
        svc = get_oversee_service()
        return svc.get_status()
    except Exception as e:
        logger.warning("Oversee status failed, returning fallback: %s", e)
        try:
            breakers = get_all_circuit_breakers()
            FALLBACK_OVERSEER_STATUS["circuit_breakers"] = breakers
        except Exception:
            pass
        return FALLBACK_OVERSEER_STATUS


@router.post("/run")
async def run_oversee_now(
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Run one OVERSEER cycle now (collect + evaluate + auto-resolve + optional LLM summary).
    When ALLOW_SEED_IN_PRODUCTION=true, allowed without auth so the dashboard Run button works on server.
    Otherwise requires authenticated user with ADMIN role.
    """
    if current_user is not None:
        if current_user.role != UserRole.ADMIN.value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    else:
        if not getattr(settings, "allow_seed_in_production", False):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sign in with an admin account to run Overseer, or set ALLOW_SEED_IN_PRODUCTION=true on server",
                headers={"WWW-Authenticate": "Bearer"},
            )
    svc = get_oversee_service()
    try:
        await svc.run_cycle(use_llm=True, include_events=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    status_res = svc.get_status()
    return {
        "status": "ok",
        "message": "Overseer cycle completed",
        "auto_resolution_actions": status_res.get("auto_resolution_actions", []),
    }


@router.get("/agent-actions")
async def get_last_agent_actions(source: Optional[str] = None, limit: int = 50):
    """
    Last agent actions for audit and observability.
    Default: most recent Overseer auto_resolution_actions from last cycle.
    Use source=all for unified log (Overseer + agentic_orchestrator + ARIN); limit caps entries.
    Use source=overseer|arin|agentic_orchestrator to filter unified log by source.
    """
    if source in ("all", "overseer", "arin", "agentic_orchestrator"):
        try:
            from src.services.agent_actions_log import get_recent
            source_filter = None if source == "all" else source
            entries = get_recent(limit=min(limit, 200), source_filter=source_filter)
            return {"source": source or "all", "entries": entries, "count": len(entries)}
        except Exception as e:
            logger.warning("Agent actions log get_recent failed: %s", e)
            return {"source": source or "all", "entries": [], "count": 0}
    try:
        svc = get_oversee_service()
        status = svc.get_status()
        actions = status.get("auto_resolution_actions") or []
        return {
            "source": "overseer",
            "actions": actions,
            "timestamp": status.get("timestamp"),
            "count": len(actions),
        }
    except Exception as e:
        logger.warning("Oversee agent-actions failed: %s", e)
        return {"source": "overseer", "actions": [], "timestamp": None, "count": 0}


@router.get("/circuit-breakers")
async def get_circuit_breakers():
    """
    Get state of all circuit breakers.
    """
    return get_all_circuit_breakers()


@router.post("/circuit-breakers/{name}/reset")
async def reset_circuit_breaker(
    name: str,
    current_user: User = Depends(get_current_user),
):
    """
    Manually reset a circuit breaker to CLOSED state. Requires ADMIN role.
    """
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Admin role required")
    try:
        breaker = get_circuit_breaker(name)
        await breaker.reset()
        return {"status": "ok", "message": f"Circuit breaker {name} reset to CLOSED"}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Circuit breaker {name} not found: {e}")
