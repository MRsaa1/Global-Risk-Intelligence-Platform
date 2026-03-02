"""
Disinformation API: analyze content, list campaigns and posts.

- POST /disinformation/analyze — analyze text or URL (NLP + risk labels)
- GET /disinformation/campaigns — list campaigns (optional panic_elevated filter)
- GET /disinformation/posts — list posts (optional campaign_id, min_risk)
"""
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.services import disinformation_service

router = APIRouter()


class AnalyzeRequest(BaseModel):
    text: Optional[str] = None
    url: Optional[str] = None
    title: Optional[str] = None
    source_id: Optional[str] = None


@router.post("/analyze", response_model=dict)
async def analyze(
    body: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Analyze content (text or URL) for disinformation risk.
    Uses NLP sentiment and heuristics; creates SENTINEL alert when risk exceeds threshold.
    """
    result = await disinformation_service.analyze_text_or_url(
        db,
        text=body.text,
        url=body.url,
        title=body.title,
        source_id=body.source_id,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    await db.commit()
    return result


@router.get("/campaigns", response_model=List[dict])
async def list_campaigns(
    panic_elevated_only: bool = False,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """List disinformation campaigns. Set panic_elevated_only=true for risk-elevated only."""
    return await disinformation_service.list_campaigns(
        db, panic_elevated_only=panic_elevated_only, limit=limit
    )


@router.get("/posts", response_model=List[dict])
async def list_posts(
    campaign_id: Optional[str] = None,
    min_risk: Optional[float] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """List analyzed posts, optionally by campaign or minimum risk score."""
    return await disinformation_service.list_posts(
        db, campaign_id=campaign_id, min_risk=min_risk, limit=limit
    )
