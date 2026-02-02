"""
AI-Q style assistant endpoints.

Provides a lightweight "ask" endpoint that returns:
- answer text
- sources (citations)

This is designed for cloud LLM now, and local GPU/NIM later via settings.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.services.aiq_research_assistant import get_aiq_assistant
from src.services.oversee import get_oversee_service

router = APIRouter()


class AiqAskRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=4000)
    asset_id: Optional[str] = None
    project_id: Optional[str] = None
    include_overseer_status: bool = True
    context: Optional[Dict[str, Any]] = None


class AiqSource(BaseModel):
    id: str
    kind: str
    title: str
    snippet: str = ""
    url: Optional[str] = None


class AiqAskResponse(BaseModel):
    answer: str
    sources: List[AiqSource]


@router.post("/ask", response_model=AiqAskResponse)
async def ask_aiq(req: AiqAskRequest):
    """
    Ask the AI-Q assistant a question.

    Returns:
    - answer text with citations like [1], [2]
    - sources array corresponding to citations
    """
    ctx: Dict[str, Any] = dict(req.context or {})
    if req.asset_id:
        ctx["asset_id"] = req.asset_id
    if req.project_id:
        ctx["project_id"] = req.project_id

    if req.include_overseer_status:
        svc = get_oversee_service()
        ctx["overseer_status"] = svc.get_status()

    aiq = get_aiq_assistant()
    result = await aiq.answer_question(question=req.question, context=ctx)
    return AiqAskResponse(
        answer=result.text,
        sources=[
            AiqSource(id=s.id, kind=s.kind, title=s.title, snippet=s.snippet, url=s.url)
            for s in (result.sources or [])
        ],
    )

