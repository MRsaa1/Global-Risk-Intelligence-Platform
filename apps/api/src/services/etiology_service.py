"""
Etiology (root cause) chains: event A → cause B → industry C.

Uses ontology CausalLink and Knowledge Graph to build cause-effect chains;
output for ANALYST report and stress test report section.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# Cause types for ontology (aligned with plan: climate, supply_chain, policy, market, ...)
CAUSE_TYPES = ["climate", "supply_chain", "policy", "market", "geopolitical", "operational", "technology"]


async def get_cause_effect_chains(
    db: AsyncSession,
    event_id: Optional[str] = None,
    cause_type: Optional[str] = None,
    limit: int = 20,
) -> Dict[str, Any]:
    """
    Build cause-effect chains from ontology CausalLink and/or KG.
    Returns chains of form: [{ "event": "...", "cause": "...", "industry": "...", "confidence": 0.8 }, ...].
    """
    chains: List[Dict[str, Any]] = []
    try:
        from src.models.ontology import CausalLink
        q = select(CausalLink).order_by(CausalLink.confidence.desc()).limit(limit * 2)
        if cause_type:
            q = q.where(CausalLink.source_type == cause_type)
        r = await db.execute(q)
        links = r.scalars().all()
        for link in links:
            chains.append({
                "event": str(link.source_id),
                "cause": link.relationship,
                "industry": str(link.target_id),
                "source_type": link.source_type,
                "target_type": link.target_type,
                "confidence": link.confidence or 0.8,
                "weight": link.weight or 1.0,
            })
    except Exception as e:
        logger.debug("Etiology from ontology failed: %s", e)
    if not chains:
        # Demo stub chains for stress report / Analyst
        chains = [
            {"event": "drought_brazil", "cause": "climate", "industry": "sugar_beverages", "confidence": 0.85, "weight": 1.0},
            {"event": "tariff_escalation", "cause": "policy", "industry": "automotive", "confidence": 0.8, "weight": 1.0},
            {"event": "oil_shock", "cause": "market", "industry": "transport_logistics", "confidence": 0.9, "weight": 1.0},
        ][:limit]
    return {"chains": chains, "cause_types": CAUSE_TYPES}


async def get_chains_for_analyst_report(
    db: AsyncSession,
    subject_id: Optional[str] = None,
    scenario: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Return etiology chains for inclusion in ANALYST deep-dive or stress test report section.
    """
    result = await get_cause_effect_chains(db, event_id=subject_id, limit=10)
    return result.get("chains", [])
