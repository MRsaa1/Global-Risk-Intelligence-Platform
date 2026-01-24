"""SRO (Systemic Risk Observatory) module - stub endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("", summary="SRO module status")
def sro_status() -> dict:
    """Return SRO module status (stub)."""
    return {"module": "sro", "status": "ok"}
