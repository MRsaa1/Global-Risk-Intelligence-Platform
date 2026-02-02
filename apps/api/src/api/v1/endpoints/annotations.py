"""Scene Annotation API endpoints."""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.annotation import SceneAnnotation, AnnotationComment, AnnotationType, AnnotationStatus

router = APIRouter()


# ==================== Schemas ====================

class AnnotationCreate(BaseModel):
    """Create annotation request."""
    asset_id: Optional[str] = None
    project_id: Optional[str] = None
    annotation_type: str = Field(default="marker")
    position_x: float = Field(default=0)
    position_y: float = Field(default=0)
    position_z: float = Field(default=0)
    title: Optional[str] = None
    text: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    priority: str = Field(default="medium")
    element_id: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    author_id: str
    author_name: Optional[str] = None


class AnnotationUpdate(BaseModel):
    """Update annotation request."""
    title: Optional[str] = None
    text: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    due_date: Optional[datetime] = None
    visible: Optional[bool] = None


class AnnotationResponse(BaseModel):
    """Annotation response."""
    id: str
    asset_id: Optional[str]
    project_id: Optional[str]
    annotation_type: str
    status: str
    priority: str
    position_x: float
    position_y: float
    position_z: float
    title: Optional[str]
    text: Optional[str]
    color: Optional[str]
    icon: Optional[str]
    visible: bool
    element_id: Optional[str]
    category: Optional[str]
    tags: Optional[list[str]]
    author_id: str
    author_name: Optional[str]
    assignee_id: Optional[str]
    assignee_name: Optional[str]
    due_date: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    resolved_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    """Create comment request."""
    text: str
    author_id: str
    author_name: Optional[str] = None
    parent_comment_id: Optional[str] = None


class CommentResponse(BaseModel):
    """Comment response."""
    id: str
    annotation_id: str
    text: str
    author_id: str
    author_name: Optional[str]
    parent_comment_id: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# ==================== Annotations CRUD ====================

@router.get("", response_model=list[AnnotationResponse])
async def list_annotations(
    asset_id: Optional[str] = None,
    project_id: Optional[str] = None,
    annotation_type: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List annotations with optional filters."""
    query = select(SceneAnnotation).order_by(SceneAnnotation.created_at.desc())
    
    if asset_id:
        query = query.where(SceneAnnotation.asset_id == asset_id)
    if project_id:
        query = query.where(SceneAnnotation.project_id == project_id)
    if annotation_type:
        query = query.where(SceneAnnotation.annotation_type == annotation_type)
    if status:
        query = query.where(SceneAnnotation.status == status)
    
    result = await db.execute(query)
    annotations = list(result.scalars().all())
    
    # Parse tags
    response = []
    for a in annotations:
        data = AnnotationResponse.model_validate(a)
        if a.tags:
            import json
            try:
                data.tags = json.loads(a.tags)
            except:
                data.tags = []
        response.append(data)
    
    return response


@router.post("", response_model=AnnotationResponse)
async def create_annotation(
    data: AnnotationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new annotation."""
    import json
    
    annotation = SceneAnnotation(
        id=str(uuid4()),
        asset_id=data.asset_id,
        project_id=data.project_id,
        annotation_type=data.annotation_type,
        position_x=data.position_x,
        position_y=data.position_y,
        position_z=data.position_z,
        title=data.title,
        text=data.text,
        color=data.color,
        icon=data.icon,
        priority=data.priority,
        element_id=data.element_id,
        category=data.category,
        tags=json.dumps(data.tags) if data.tags else None,
        author_id=data.author_id,
        author_name=data.author_name,
        created_at=datetime.utcnow(),
    )
    
    db.add(annotation)
    await db.commit()
    await db.refresh(annotation)
    
    return annotation


@router.get("/{annotation_id}", response_model=AnnotationResponse)
async def get_annotation(
    annotation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get annotation by ID."""
    result = await db.execute(
        select(SceneAnnotation).where(SceneAnnotation.id == annotation_id)
    )
    annotation = result.scalar_one_or_none()
    
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    
    return annotation


@router.patch("/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: str,
    data: AnnotationUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update annotation."""
    result = await db.execute(
        select(SceneAnnotation).where(SceneAnnotation.id == annotation_id)
    )
    annotation = result.scalar_one_or_none()
    
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(annotation, key, value)
    
    if data.status == "resolved":
        annotation.resolved_at = datetime.utcnow()
    
    annotation.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(annotation)
    
    return annotation


@router.delete("/{annotation_id}")
async def delete_annotation(
    annotation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete annotation."""
    result = await db.execute(
        select(SceneAnnotation).where(SceneAnnotation.id == annotation_id)
    )
    annotation = result.scalar_one_or_none()
    
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    
    await db.delete(annotation)
    await db.commit()
    
    return {"status": "deleted", "id": annotation_id}


# ==================== Comments ====================

@router.get("/{annotation_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    annotation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List comments for an annotation."""
    result = await db.execute(
        select(AnnotationComment)
        .where(AnnotationComment.annotation_id == annotation_id)
        .order_by(AnnotationComment.created_at)
    )
    return list(result.scalars().all())


@router.post("/{annotation_id}/comments", response_model=CommentResponse)
async def add_comment(
    annotation_id: str,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add comment to an annotation."""
    # Verify annotation exists
    result = await db.execute(
        select(SceneAnnotation).where(SceneAnnotation.id == annotation_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Annotation not found")
    
    comment = AnnotationComment(
        id=str(uuid4()),
        annotation_id=annotation_id,
        text=data.text,
        author_id=data.author_id,
        author_name=data.author_name,
        parent_comment_id=data.parent_comment_id,
        created_at=datetime.utcnow(),
    )
    
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    
    return comment


@router.delete("/{annotation_id}/comments/{comment_id}")
async def delete_comment(
    annotation_id: str,
    comment_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a comment."""
    result = await db.execute(
        select(AnnotationComment)
        .where(AnnotationComment.id == comment_id)
        .where(AnnotationComment.annotation_id == annotation_id)
    )
    comment = result.scalar_one_or_none()
    
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    await db.delete(comment)
    await db.commit()
    
    return {"status": "deleted", "id": comment_id}


# ==================== Bulk Operations ====================

@router.post("/bulk-update-status")
async def bulk_update_status(
    annotation_ids: list[str],
    status: str,
    db: AsyncSession = Depends(get_db),
):
    """Bulk update annotation status."""
    result = await db.execute(
        select(SceneAnnotation).where(SceneAnnotation.id.in_(annotation_ids))
    )
    annotations = list(result.scalars().all())
    
    for annotation in annotations:
        annotation.status = status
        if status == "resolved":
            annotation.resolved_at = datetime.utcnow()
        annotation.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {"updated_count": len(annotations)}
