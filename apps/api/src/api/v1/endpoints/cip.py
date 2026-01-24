"""CIP (Critical Infrastructure Protection) module - stub endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("", summary="CIP module status")
def cip_status() -> dict:
    """Return CIP module status (stub)."""
    return {"module": "cip", "status": "ok"}
