"""User Preferences model for saved filters, dashboard settings, etc."""
import enum
from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import uuid4

from sqlalchemy import DateTime, String, Text, ForeignKey, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class PreferenceType(str, enum.Enum):
    """Types of user preferences."""
    SAVED_FILTER = "saved_filter"
    DASHBOARD_LAYOUT = "dashboard_layout"
    NOTIFICATION_SETTINGS = "notification_settings"
    DISPLAY_SETTINGS = "display_settings"
    WATCHLIST = "watchlist"
    QUICK_ACTION = "quick_action"
    REPORT_TEMPLATE = "report_template"


class UserPreference(Base):
    """
    User preferences storage.
    
    Supports various types of preferences:
    - Saved filters for assets, stress tests, etc.
    - Dashboard layout configurations
    - Notification settings
    - Display preferences (theme, language, etc.)
    - Watchlists for assets/regions
    """
    __tablename__ = "user_preferences"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Preference identification
    preference_type: Mapped[str] = mapped_column(
        String(50),
        index=True,
    )
    
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # The actual preference data (JSON)
    data: Mapped[Dict] = mapped_column(JSON, default=dict)
    
    # For filters/views: which entity type it applies to
    entity_type: Mapped[Optional[str]] = mapped_column(String(50))
    
    # Flags
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    
    def __repr__(self) -> str:
        return f"<UserPreference {self.name} ({self.preference_type})>"


class SavedFilter(Base):
    """
    Saved filter configuration for quick access.
    
    Stores filter criteria for assets, stress tests, alerts, etc.
    """
    __tablename__ = "saved_filters"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Filter identification
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # What entity this filter applies to
    entity_type: Mapped[str] = mapped_column(
        String(50),
        index=True,
    )  # assets, stress_tests, alerts, etc.
    
    # The filter criteria (JSON)
    filters: Mapped[Dict] = mapped_column(JSON, default=dict)
    
    # Sorting preferences
    sort_by: Mapped[Optional[str]] = mapped_column(String(50))
    sort_order: Mapped[str] = mapped_column(String(10), default="desc")
    
    # Page size preference
    page_size: Mapped[int] = mapped_column(default=20)
    
    # Flags
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Usage tracking
    use_count: Mapped[int] = mapped_column(default=0)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    
    def __repr__(self) -> str:
        return f"<SavedFilter {self.name} ({self.entity_type})>"


class DashboardWidget(Base):
    """
    Dashboard widget configuration.
    
    Stores user's custom dashboard layout.
    """
    __tablename__ = "dashboard_widgets"
    
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Dashboard identification (user can have multiple dashboards)
    dashboard_id: Mapped[str] = mapped_column(String(50), default="main")
    
    # Widget type
    widget_type: Mapped[str] = mapped_column(String(50))
    # risk_overview, asset_map, alerts, stress_tests, portfolio_chart, etc.
    
    # Position and size (grid-based layout)
    position_x: Mapped[int] = mapped_column(default=0)
    position_y: Mapped[int] = mapped_column(default=0)
    width: Mapped[int] = mapped_column(default=1)
    height: Mapped[int] = mapped_column(default=1)
    
    # Widget-specific configuration
    config: Mapped[Dict] = mapped_column(JSON, default=dict)
    
    # Visibility
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    is_collapsed: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    
    def __repr__(self) -> str:
        return f"<DashboardWidget {self.widget_type} at ({self.position_x}, {self.position_y})>"
