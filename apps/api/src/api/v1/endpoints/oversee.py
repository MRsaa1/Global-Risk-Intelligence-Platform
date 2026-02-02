"""
OVERSEER API - System-wide monitoring AI.

GET /status: last snapshot, system_alerts, executive_summary.
POST /run: trigger one oversee cycle manually.
GET /circuit-breakers: get all circuit breaker states.
POST /circuit-breakers/{name}/reset: reset a circuit breaker.
"""
import logging
from fastapi import APIRouter, HTTPException

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
async def run_oversee_now():
    """
    Run one OVERSEER cycle now (collect + evaluate + optional LLM summary).
    """
    svc = get_oversee_service()
    try:
        await svc.run_cycle(use_llm=True, include_events=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "ok", "message": "Overseer cycle completed"}


@router.get("/circuit-breakers")
async def get_circuit_breakers():
    """
    Get state of all circuit breakers.
    """
    return get_all_circuit_breakers()


@router.post("/circuit-breakers/{name}/reset")
async def reset_circuit_breaker(name: str):
    """
    Manually reset a circuit breaker to CLOSED state.
    """
    try:
        breaker = get_circuit_breaker(name)
        await breaker.reset()
        return {"status": "ok", "message": f"Circuit breaker {name} reset to CLOSED"}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Circuit breaker {name} not found: {e}")
