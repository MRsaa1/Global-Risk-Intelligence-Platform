"""
LPR (Leader/Persona Risk) API: profiles, trends, appearances.

- GET /lpr/profile/{id} — full profile with appearances and flags
- GET /lpr/trends — recent appearances and stress/contradiction/course-change
- GET /lpr/entities — list entities (optional region/type)
- POST /lpr/entities — create entity
- POST /lpr/appearances — create appearance (optional transcript for demo metrics)
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.services import lpr_service

router = APIRouter()


class LprEntityCreate(BaseModel):
    name: str
    entity_type: str = "person"
    role: Optional[str] = None
    region: Optional[str] = None
    doctrine_ref: Optional[str] = None


class LprAppearanceCreate(BaseModel):
    entity_id: str
    source_type: str = "video"
    source_url: Optional[str] = None
    title: Optional[str] = None
    occurred_at: Optional[str] = None
    transcript: Optional[str] = None
    language: str = "en"


@router.get("/entities", response_model=List[dict])
async def list_entities(
    region: Optional[str] = None,
    entity_type: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """List LPR entities (persons/organizations) with optional filters."""
    entities = await lpr_service.list_entities(db, region=region, entity_type=entity_type, active_only=active_only)
    return [
        {"id": e.id, "name": e.name, "entity_type": e.entity_type, "role": e.role, "region": e.region}
        for e in entities
    ]


@router.post("/entities", response_model=dict)
async def create_entity(
    body: LprEntityCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new LPR entity."""
    entity = await lpr_service.create_entity(
        db,
        name=body.name,
        entity_type=body.entity_type,
        role=body.role,
        region=body.region,
        doctrine_ref=body.doctrine_ref,
    )
    await db.commit()
    return {"id": entity.id, "name": entity.name, "entity_type": entity.entity_type, "region": entity.region}


@router.get("/profile/{entity_id}", response_model=dict)
async def get_profile(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get full LPR profile: entity, appearances, and contradiction/course-change flags."""
    profile = await lpr_service.get_profile(db, entity_id)
    if not profile:
        raise HTTPException(status_code=404, detail="LPR entity not found")
    return profile


@router.get("/trends", response_model=dict)
async def get_trends(
    entity_id: Optional[str] = None,
    region: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """LPR trends for Command Center: recent appearances with stress and course-change flags."""
    return await lpr_service.get_trends(db, entity_id=entity_id, region=region, limit=limit)


@router.post("/appearances", response_model=dict)
async def create_appearance(
    body: LprAppearanceCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create an LPR appearance (media event). If transcript provided, demo metrics are computed."""
    occurred = None
    if body.occurred_at:
        try:
            occurred = datetime.fromisoformat(body.occurred_at.replace("Z", "+00:00"))
        except Exception:
            pass
    try:
        app = await lpr_service.create_appearance(
            db,
            entity_id=body.entity_id,
            source_type=body.source_type,
            source_url=body.source_url,
            title=body.title,
            occurred_at=occurred,
            transcript=body.transcript,
            language=body.language,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    await db.commit()
    return {
        "id": app.id,
        "entity_id": app.entity_id,
        "title": app.title,
        "occurred_at": app.occurred_at.isoformat() if app.occurred_at else None,
    }
