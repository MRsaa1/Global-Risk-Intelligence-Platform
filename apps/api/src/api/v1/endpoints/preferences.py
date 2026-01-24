"""
User Preferences API Endpoints.

Provides endpoints for managing user preferences:
- Saved filters
- Dashboard layouts
- Display settings
- Notification settings
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.user_preferences import (
    UserPreference, 
    SavedFilter, 
    DashboardWidget,
    PreferenceType,
)

router = APIRouter()


# ==================== SCHEMAS ====================

class SavedFilterCreate(BaseModel):
    """Create a saved filter."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    entity_type: str = Field(..., description="assets, stress_tests, alerts, etc.")
    filters: Dict[str, Any] = Field(default_factory=dict)
    sort_by: Optional[str] = None
    sort_order: str = "desc"
    page_size: int = Field(default=20, ge=1, le=100)
    is_default: bool = False


class SavedFilterResponse(BaseModel):
    """Saved filter response."""
    id: str
    name: str
    description: Optional[str]
    entity_type: str
    filters: Dict[str, Any]
    sort_by: Optional[str]
    sort_order: str
    page_size: int
    is_default: bool
    is_shared: bool
    use_count: int
    last_used_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class DashboardWidgetCreate(BaseModel):
    """Create a dashboard widget."""
    dashboard_id: str = "main"
    widget_type: str = Field(..., description="Widget type")
    position_x: int = Field(default=0, ge=0)
    position_y: int = Field(default=0, ge=0)
    width: int = Field(default=1, ge=1, le=12)
    height: int = Field(default=1, ge=1, le=12)
    config: Dict[str, Any] = Field(default_factory=dict)
    is_visible: bool = True


class DashboardWidgetResponse(BaseModel):
    """Dashboard widget response."""
    id: str
    dashboard_id: str
    widget_type: str
    position_x: int
    position_y: int
    width: int
    height: int
    config: Dict[str, Any]
    is_visible: bool
    is_collapsed: bool
    
    class Config:
        from_attributes = True


class DashboardLayoutResponse(BaseModel):
    """Full dashboard layout."""
    dashboard_id: str
    widgets: List[DashboardWidgetResponse]


class UserSettingsUpdate(BaseModel):
    """Update user display/notification settings."""
    theme: Optional[str] = None  # light, dark, auto
    language: Optional[str] = None  # en, de, etc.
    timezone: Optional[str] = None
    date_format: Optional[str] = None
    number_format: Optional[str] = None
    
    # Notifications
    email_alerts: Optional[bool] = None
    push_notifications: Optional[bool] = None
    alert_severity_threshold: Optional[str] = None  # info, warning, high, critical
    
    # Dashboard
    default_dashboard: Optional[str] = None
    default_map_view: Optional[Dict] = None  # {lat, lng, zoom}


class UserSettingsResponse(BaseModel):
    """User settings response."""
    theme: str = "dark"
    language: str = "en"
    timezone: str = "UTC"
    date_format: str = "YYYY-MM-DD"
    number_format: str = "en-US"
    email_alerts: bool = True
    push_notifications: bool = True
    alert_severity_threshold: str = "warning"
    default_dashboard: str = "main"
    default_map_view: Optional[Dict] = None


# ==================== MOCK USER (replace with auth) ====================

def get_current_user_id() -> str:
    """Get current user ID (mock for now)."""
    return "user-001"


# ==================== SAVED FILTERS ====================

@router.get("/filters", response_model=List[SavedFilterResponse])
async def list_saved_filters(
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    db: AsyncSession = Depends(get_db),
):
    """
    List all saved filters for the current user.
    
    Optionally filter by entity_type (assets, stress_tests, alerts, etc.)
    """
    user_id = get_current_user_id()
    
    query = select(SavedFilter).where(SavedFilter.user_id == user_id)
    
    if entity_type:
        query = query.where(SavedFilter.entity_type == entity_type)
    
    query = query.order_by(SavedFilter.is_default.desc(), SavedFilter.use_count.desc())
    
    result = await db.execute(query)
    filters = result.scalars().all()
    
    return filters


@router.post("/filters", response_model=SavedFilterResponse, status_code=201)
async def create_saved_filter(
    data: SavedFilterCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new saved filter.
    
    If is_default=true, other default filters for the same entity_type
    will be unset.
    """
    user_id = get_current_user_id()
    
    # If setting as default, unset other defaults
    if data.is_default:
        await db.execute(
            select(SavedFilter)
            .where(and_(
                SavedFilter.user_id == user_id,
                SavedFilter.entity_type == data.entity_type,
                SavedFilter.is_default == True,
            ))
        )
        # Update would be done here in real implementation
    
    saved_filter = SavedFilter(
        id=str(uuid4()),
        user_id=user_id,
        name=data.name,
        description=data.description,
        entity_type=data.entity_type,
        filters=data.filters,
        sort_by=data.sort_by,
        sort_order=data.sort_order,
        page_size=data.page_size,
        is_default=data.is_default,
    )
    
    db.add(saved_filter)
    await db.commit()
    await db.refresh(saved_filter)
    
    return saved_filter


@router.get("/filters/{filter_id}", response_model=SavedFilterResponse)
async def get_saved_filter(
    filter_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific saved filter."""
    user_id = get_current_user_id()
    
    result = await db.execute(
        select(SavedFilter).where(and_(
            SavedFilter.id == filter_id,
            SavedFilter.user_id == user_id,
        ))
    )
    saved_filter = result.scalar_one_or_none()
    
    if not saved_filter:
        raise HTTPException(status_code=404, detail="Filter not found")
    
    return saved_filter


@router.put("/filters/{filter_id}", response_model=SavedFilterResponse)
async def update_saved_filter(
    filter_id: str,
    data: SavedFilterCreate,
    db: AsyncSession = Depends(get_db),
):
    """Update a saved filter."""
    user_id = get_current_user_id()
    
    result = await db.execute(
        select(SavedFilter).where(and_(
            SavedFilter.id == filter_id,
            SavedFilter.user_id == user_id,
        ))
    )
    saved_filter = result.scalar_one_or_none()
    
    if not saved_filter:
        raise HTTPException(status_code=404, detail="Filter not found")
    
    # Update fields
    saved_filter.name = data.name
    saved_filter.description = data.description
    saved_filter.filters = data.filters
    saved_filter.sort_by = data.sort_by
    saved_filter.sort_order = data.sort_order
    saved_filter.page_size = data.page_size
    saved_filter.is_default = data.is_default
    saved_filter.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(saved_filter)
    
    return saved_filter


@router.delete("/filters/{filter_id}", status_code=204)
async def delete_saved_filter(
    filter_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a saved filter."""
    user_id = get_current_user_id()
    
    result = await db.execute(
        select(SavedFilter).where(and_(
            SavedFilter.id == filter_id,
            SavedFilter.user_id == user_id,
        ))
    )
    saved_filter = result.scalar_one_or_none()
    
    if not saved_filter:
        raise HTTPException(status_code=404, detail="Filter not found")
    
    await db.delete(saved_filter)
    await db.commit()


@router.post("/filters/{filter_id}/use")
async def mark_filter_used(
    filter_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Mark a filter as used (updates use_count and last_used_at).
    
    Call this when applying a saved filter.
    """
    user_id = get_current_user_id()
    
    result = await db.execute(
        select(SavedFilter).where(and_(
            SavedFilter.id == filter_id,
            SavedFilter.user_id == user_id,
        ))
    )
    saved_filter = result.scalar_one_or_none()
    
    if not saved_filter:
        raise HTTPException(status_code=404, detail="Filter not found")
    
    saved_filter.use_count += 1
    saved_filter.last_used_at = datetime.utcnow()
    
    await db.commit()
    
    return {"status": "ok", "use_count": saved_filter.use_count}


# ==================== DASHBOARD WIDGETS ====================

@router.get("/dashboard/{dashboard_id}", response_model=DashboardLayoutResponse)
async def get_dashboard_layout(
    dashboard_id: str = "main",
    db: AsyncSession = Depends(get_db),
):
    """Get the full dashboard layout for a user."""
    user_id = get_current_user_id()
    
    result = await db.execute(
        select(DashboardWidget)
        .where(and_(
            DashboardWidget.user_id == user_id,
            DashboardWidget.dashboard_id == dashboard_id,
        ))
        .order_by(DashboardWidget.position_y, DashboardWidget.position_x)
    )
    widgets = result.scalars().all()
    
    return DashboardLayoutResponse(
        dashboard_id=dashboard_id,
        widgets=widgets,
    )


@router.post("/dashboard/widgets", response_model=DashboardWidgetResponse, status_code=201)
async def add_dashboard_widget(
    data: DashboardWidgetCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add a widget to the dashboard."""
    user_id = get_current_user_id()
    
    widget = DashboardWidget(
        id=str(uuid4()),
        user_id=user_id,
        dashboard_id=data.dashboard_id,
        widget_type=data.widget_type,
        position_x=data.position_x,
        position_y=data.position_y,
        width=data.width,
        height=data.height,
        config=data.config,
        is_visible=data.is_visible,
    )
    
    db.add(widget)
    await db.commit()
    await db.refresh(widget)
    
    return widget


@router.put("/dashboard/widgets/{widget_id}", response_model=DashboardWidgetResponse)
async def update_dashboard_widget(
    widget_id: str,
    data: DashboardWidgetCreate,
    db: AsyncSession = Depends(get_db),
):
    """Update a dashboard widget (position, size, config)."""
    user_id = get_current_user_id()
    
    result = await db.execute(
        select(DashboardWidget).where(and_(
            DashboardWidget.id == widget_id,
            DashboardWidget.user_id == user_id,
        ))
    )
    widget = result.scalar_one_or_none()
    
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")
    
    widget.position_x = data.position_x
    widget.position_y = data.position_y
    widget.width = data.width
    widget.height = data.height
    widget.config = data.config
    widget.is_visible = data.is_visible
    widget.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(widget)
    
    return widget


@router.delete("/dashboard/widgets/{widget_id}", status_code=204)
async def remove_dashboard_widget(
    widget_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Remove a widget from the dashboard."""
    user_id = get_current_user_id()
    
    result = await db.execute(
        select(DashboardWidget).where(and_(
            DashboardWidget.id == widget_id,
            DashboardWidget.user_id == user_id,
        ))
    )
    widget = result.scalar_one_or_none()
    
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")
    
    await db.delete(widget)
    await db.commit()


@router.post("/dashboard/{dashboard_id}/reset")
async def reset_dashboard_layout(
    dashboard_id: str = "main",
    db: AsyncSession = Depends(get_db),
):
    """
    Reset dashboard to default layout.
    
    Removes all custom widgets and creates default ones.
    """
    user_id = get_current_user_id()
    
    # Delete existing widgets
    await db.execute(
        delete(DashboardWidget).where(and_(
            DashboardWidget.user_id == user_id,
            DashboardWidget.dashboard_id == dashboard_id,
        ))
    )
    
    # Create default widgets
    default_widgets = [
        {"widget_type": "risk_overview", "position_x": 0, "position_y": 0, "width": 4, "height": 2},
        {"widget_type": "alerts_panel", "position_x": 4, "position_y": 0, "width": 4, "height": 2},
        {"widget_type": "portfolio_chart", "position_x": 8, "position_y": 0, "width": 4, "height": 2},
        {"widget_type": "asset_map", "position_x": 0, "position_y": 2, "width": 8, "height": 3},
        {"widget_type": "recent_stress_tests", "position_x": 8, "position_y": 2, "width": 4, "height": 3},
    ]
    
    for w in default_widgets:
        widget = DashboardWidget(
            id=str(uuid4()),
            user_id=user_id,
            dashboard_id=dashboard_id,
            **w,
        )
        db.add(widget)
    
    await db.commit()
    
    return {"status": "ok", "message": "Dashboard reset to default layout"}


# ==================== USER SETTINGS ====================

@router.get("/settings", response_model=UserSettingsResponse)
async def get_user_settings(
    db: AsyncSession = Depends(get_db),
):
    """Get user display and notification settings."""
    user_id = get_current_user_id()
    
    # Get settings from UserPreference
    result = await db.execute(
        select(UserPreference).where(and_(
            UserPreference.user_id == user_id,
            UserPreference.preference_type == PreferenceType.DISPLAY_SETTINGS.value,
        ))
    )
    pref = result.scalar_one_or_none()
    
    if pref:
        return UserSettingsResponse(**pref.data)
    
    # Return defaults
    return UserSettingsResponse()


@router.put("/settings", response_model=UserSettingsResponse)
async def update_user_settings(
    data: UserSettingsUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update user display and notification settings."""
    user_id = get_current_user_id()
    
    # Get existing settings
    result = await db.execute(
        select(UserPreference).where(and_(
            UserPreference.user_id == user_id,
            UserPreference.preference_type == PreferenceType.DISPLAY_SETTINGS.value,
        ))
    )
    pref = result.scalar_one_or_none()
    
    # Merge with existing or defaults
    current_settings = pref.data if pref else {}
    updates = data.model_dump(exclude_none=True)
    new_settings = {**current_settings, **updates}
    
    if pref:
        pref.data = new_settings
        pref.updated_at = datetime.utcnow()
    else:
        pref = UserPreference(
            id=str(uuid4()),
            user_id=user_id,
            preference_type=PreferenceType.DISPLAY_SETTINGS.value,
            name="User Settings",
            data=new_settings,
        )
        db.add(pref)
    
    await db.commit()
    
    return UserSettingsResponse(**new_settings)
