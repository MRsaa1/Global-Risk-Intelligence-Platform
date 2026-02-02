"""Scene Annotation models for 3D collaboration."""
import enum
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class AnnotationType(str, enum.Enum):
    """Type of scene annotation."""
    MARKER = "marker"
    NOTE = "note"
    ISSUE = "issue"
    MEASUREMENT = "measurement"
    AREA = "area"
    VOLUME = "volume"
    HOTSPOT = "hotspot"
    WAYPOINT = "waypoint"


class AnnotationStatus(str, enum.Enum):
    """Status of annotation (for issues)."""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class AnnotationPriority(str, enum.Enum):
    """Priority level for annotations."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SceneAnnotation(Base):
    """
    Annotation placed in 3D scene for collaboration.
    
    Supports markers, notes, issues, and measurements
    attached to specific 3D positions.
    """
    __tablename__ = "scene_annotations"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    
    # Association (at least one should be set)
    asset_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="CASCADE"),
        index=True,
    )
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Classification
    annotation_type: Mapped[str] = mapped_column(
        String(50),
        default=AnnotationType.MARKER.value,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default=AnnotationStatus.OPEN.value,
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        default=AnnotationPriority.MEDIUM.value,
    )
    
    # Position in 3D space
    position_x: Mapped[float] = mapped_column(Float, default=0)
    position_y: Mapped[float] = mapped_column(Float, default=0)
    position_z: Mapped[float] = mapped_column(Float, default=0)
    
    # Optional camera/view state
    camera_position_x: Mapped[Optional[float]] = mapped_column(Float)
    camera_position_y: Mapped[Optional[float]] = mapped_column(Float)
    camera_position_z: Mapped[Optional[float]] = mapped_column(Float)
    camera_target_x: Mapped[Optional[float]] = mapped_column(Float)
    camera_target_y: Mapped[Optional[float]] = mapped_column(Float)
    camera_target_z: Mapped[Optional[float]] = mapped_column(Float)
    
    # For measurements
    end_position_x: Mapped[Optional[float]] = mapped_column(Float)
    end_position_y: Mapped[Optional[float]] = mapped_column(Float)
    end_position_z: Mapped[Optional[float]] = mapped_column(Float)
    measurement_value: Mapped[Optional[float]] = mapped_column(Float)
    measurement_unit: Mapped[Optional[str]] = mapped_column(String(20))
    
    # Content
    title: Mapped[Optional[str]] = mapped_column(String(255))
    text: Mapped[Optional[str]] = mapped_column(Text)
    
    # Visual
    color: Mapped[Optional[str]] = mapped_column(String(20))  # hex color
    icon: Mapped[Optional[str]] = mapped_column(String(50))
    scale: Mapped[float] = mapped_column(Float, default=1.0)
    visible: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Attachments
    attachment_paths: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    screenshot_path: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Element reference (e.g., BIM element ID)
    element_id: Mapped[Optional[str]] = mapped_column(String(100))
    element_type: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Tags and categories
    tags: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    category: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Author
    author_id: Mapped[str] = mapped_column(String(36))
    author_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Assignment (for issues)
    assignee_id: Mapped[Optional[str]] = mapped_column(String(36))
    assignee_name: Mapped[Optional[str]] = mapped_column(String(255))
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Metadata
    extra_data: Mapped[Optional[str]] = mapped_column(Text)
    
    def __repr__(self) -> str:
        return f"<SceneAnnotation {self.annotation_type}: {self.title}>"


class AnnotationComment(Base):
    """
    Comment on a scene annotation for threaded discussions.
    """
    __tablename__ = "annotation_comments"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    annotation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("scene_annotations.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Content
    text: Mapped[str] = mapped_column(Text)
    
    # Author
    author_id: Mapped[str] = mapped_column(String(36))
    author_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Reply to (for threading)
    parent_comment_id: Mapped[Optional[str]] = mapped_column(String(36))
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)
    
    def __repr__(self) -> str:
        return f"<AnnotationComment {self.id[:8]}>"
