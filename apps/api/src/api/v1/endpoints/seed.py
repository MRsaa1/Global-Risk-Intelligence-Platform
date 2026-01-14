"""
Seed data endpoints - For development and demos.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.core.security import require_admin
from src.models.user import User
from src.services.seed_data import seed_all

router = APIRouter()


@router.post("/seed")
async def seed_sample_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Seed sample data for demos and alpha users.
    
    Creates:
    - 5 sample assets across Germany
    - Digital twins with timelines
    - Knowledge graph relationships
    
    Requires ADMIN role.
    """
    if settings.environment == "production":
        raise HTTPException(
            status_code=403,
            detail="Seeding is disabled in production",
        )
    
    try:
        result = await seed_all(db)
        return {
            "status": "success",
            "message": "Sample data seeded successfully",
            **result,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Seeding failed: {str(e)}",
        )


@router.delete("/seed")
async def clear_sample_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Clear all sample data.
    
    WARNING: This deletes all assets, twins, and graph data.
    Requires ADMIN role.
    """
    if settings.environment == "production":
        raise HTTPException(
            status_code=403,
            detail="Clearing data is disabled in production",
        )
    
    # In production, this would be more sophisticated
    # For now, just return a message
    return {
        "status": "info",
        "message": "Data clearing not implemented. Use database reset instead.",
    }
