"""SCSS (Supply Chain Sovereignty System) module - stub endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("", summary="SCSS module status")
def scss_status() -> dict:
    """Return SCSS module status (stub)."""
    return {"module": "scss", "status": "ok"}
