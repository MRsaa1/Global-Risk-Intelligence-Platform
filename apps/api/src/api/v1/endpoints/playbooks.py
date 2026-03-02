"""Playbooks API — list playbooks, get next actions, complete step."""
from typing import Optional

from fastapi import APIRouter, Query

from src.services.playbook_engine import (
    list_playbooks as engine_list_playbooks,
    get_playbook as engine_get_playbook,
    get_next_actions,
    record_step_complete,
)

router = APIRouter()


@router.get("")
async def playbooks_list():
    """List available playbooks (e.g. Flood response, City launch)."""
    return {"playbooks": engine_list_playbooks()}


@router.get("/{playbook_id}")
async def playbook_detail(playbook_id: str):
    """Get one playbook with steps."""
    pb = engine_get_playbook(playbook_id)
    if not pb:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Playbook not found")
    return pb


@router.get("/{playbook_id}/next-actions")
async def next_actions(
    playbook_id: str,
    municipality_id: Optional[str] = Query(None, description="Municipality/community id"),
    limit: Optional[int] = Query(3, ge=1, le=10),
):
    """
    Get 1–3 recommended «do now» actions for the municipality.
    Used by Municipal Dashboard «Recommended actions» block.
    """
    mid = municipality_id or "bastrop_tx"
    return await get_next_actions(playbook_id, mid, limit=limit or 3)


@router.post("/{playbook_id}/steps/{step_id}/complete")
async def complete_step(
    playbook_id: str,
    step_id: str,
    municipality_id: Optional[str] = Query(None),
    actor: Optional[str] = Query("api"),
):
    """Record that a playbook step was completed (audit)."""
    mid = municipality_id or "bastrop_tx"
    return record_step_complete(playbook_id, step_id, mid, actor=actor or "api")
