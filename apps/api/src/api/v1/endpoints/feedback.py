"""
User feedback endpoints - Collect feedback from alpha users.
"""
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.security import get_current_active_user
from src.models.user import User

router = APIRouter()


class FeedbackCreate(BaseModel):
    """Feedback submission."""
    type: str = Field(..., description="bug, feature, improvement, other")
    message: str = Field(..., min_length=1, max_length=5000)
    rating: int = Field(default=5, ge=1, le=5)
    page_url: str | None = None
    user_agent: str | None = None


class FeedbackResponse(BaseModel):
    """Feedback response."""
    id: str
    submitted_at: datetime
    status: str = "received"


@router.post("", response_model=FeedbackResponse, status_code=201)
async def submit_feedback(
    feedback: FeedbackCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit user feedback.
    
    Collects feedback from alpha users to improve the platform.
    """
    feedback_id = uuid4()
    
    # In production, store in database
    # For now, just log it
    import logging
    logger = logging.getLogger(__name__)
    logger.info(
        f"Feedback received from {current_user.email}: "
        f"Type={feedback.type}, Rating={feedback.rating}, "
        f"Message={feedback.message[:100]}..."
    )
    
    # Could store in database:
    # feedback_record = Feedback(
    #     id=feedback_id,
    #     user_id=current_user.id,
    #     type=feedback.type,
    #     message=feedback.message,
    #     rating=feedback.rating,
    #     page_url=feedback.page_url,
    #     user_agent=feedback.user_agent,
    # )
    # db.add(feedback_record)
    # await db.commit()
    
    return FeedbackResponse(
        id=str(feedback_id),
        submitted_at=datetime.utcnow(),
        status="received",
    )
