"""
Audit Log API Endpoints.

Provides endpoints for:
- Querying audit logs
- Exporting audit data
- Audit statistics
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from src.services.audit_log import (
    audit_service,
    AuditAction,
    AuditCategory,
    AuditSeverity,
    AuditLogEntry,
)

router = APIRouter()


# ==================== SCHEMAS ====================

class AuditLogResponse(BaseModel):
    """Audit log entry response."""
    id: str
    timestamp: datetime
    user_id: Optional[str]
    user_email: Optional[str]
    ip_address: Optional[str]
    action: str
    category: str
    severity: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    endpoint: Optional[str]
    method: Optional[str]
    description: str
    success: bool
    error_message: Optional[str]
    duration_ms: Optional[int]


class AuditQueryResult(BaseModel):
    """Paginated audit log query result."""
    items: List[AuditLogResponse]
    total: int
    limit: int
    offset: int


class AuditStats(BaseModel):
    """Audit log statistics."""
    total: int
    by_category: dict
    by_action: dict
    oldest: Optional[str]
    newest: Optional[str]


# ==================== HELPER ====================

def _entry_to_response(entry: AuditLogEntry) -> AuditLogResponse:
    """Convert AuditLogEntry to response model."""
    return AuditLogResponse(
        id=entry.id,
        timestamp=entry.timestamp,
        user_id=entry.user_id,
        user_email=entry.user_email,
        ip_address=entry.ip_address,
        action=entry.action.value,
        category=entry.category.value,
        severity=entry.severity.value,
        resource_type=entry.resource_type,
        resource_id=entry.resource_id,
        endpoint=entry.endpoint,
        method=entry.method,
        description=entry.description,
        success=entry.success,
        error_message=entry.error_message,
        duration_ms=entry.duration_ms,
    )


# ==================== ENDPOINTS ====================

@router.get("/logs", response_model=AuditQueryResult)
async def query_audit_logs(
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    action: Optional[str] = Query(None, description="Filter by action"),
    category: Optional[str] = Query(None, description="Filter by category"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    resource_id: Optional[str] = Query(None, description="Filter by resource ID"),
    start_time: Optional[datetime] = Query(None, description="Start time filter"),
    end_time: Optional[datetime] = Query(None, description="End time filter"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    Query audit logs with filters.
    
    **Filters:**
    - user_id: Filter by user ID
    - action: Filter by action type (login, create, update, delete, etc.)
    - category: Filter by category (auth, data, security, system, admin)
    - resource_type: Filter by resource type (asset, stress_test, user, etc.)
    - resource_id: Filter by specific resource ID
    - start_time/end_time: Time range filter
    
    **Pagination:**
    - limit: Max results (default 50, max 500)
    - offset: Skip first N results
    """
    # Parse enum values
    action_enum = None
    if action:
        try:
            action_enum = AuditAction(action)
        except ValueError:
            pass
    
    category_enum = None
    if category:
        try:
            category_enum = AuditCategory(category)
        except ValueError:
            pass
    
    # Query logs
    logs = await audit_service.query(
        user_id=user_id,
        action=action_enum,
        category=category_enum,
        resource_type=resource_type,
        resource_id=resource_id,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
        offset=offset,
    )
    
    # Get total count
    total = await audit_service.count(
        user_id=user_id,
        action=action_enum,
        category=category_enum,
        resource_type=resource_type,
        resource_id=resource_id,
        start_time=start_time,
        end_time=end_time,
    )
    
    return AuditQueryResult(
        items=[_entry_to_response(e) for e in logs],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/logs/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(log_id: str):
    """Get a specific audit log entry by ID."""
    logs = await audit_service.query(limit=10000)
    for log in logs:
        if log.id == log_id:
            return _entry_to_response(log)
    
    raise HTTPException(status_code=404, detail="Audit log entry not found")


@router.get("/stats", response_model=AuditStats)
async def get_audit_stats():
    """
    Get audit log statistics.
    
    Returns:
    - Total number of logs
    - Count by category
    - Count by action
    - Oldest/newest timestamps
    """
    stats = audit_service.stats()
    return AuditStats(**stats)


@router.get("/user/{user_id}", response_model=AuditQueryResult)
async def get_user_audit_trail(
    user_id: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    Get complete audit trail for a specific user.
    
    Returns all actions performed by or affecting the user.
    """
    logs = await audit_service.query(user_id=user_id, limit=limit, offset=offset)
    total = await audit_service.count(user_id=user_id)
    
    return AuditQueryResult(
        items=[_entry_to_response(e) for e in logs],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/resource/{resource_type}/{resource_id}", response_model=AuditQueryResult)
async def get_resource_audit_trail(
    resource_type: str,
    resource_id: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    Get complete audit trail for a specific resource.
    
    Returns all changes made to the resource.
    """
    logs = await audit_service.query(
        resource_type=resource_type,
        resource_id=resource_id,
        limit=limit,
        offset=offset,
    )
    total = await audit_service.count(
        resource_type=resource_type,
        resource_id=resource_id,
    )
    
    return AuditQueryResult(
        items=[_entry_to_response(e) for e in logs],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/actions")
async def get_available_actions():
    """Get list of available audit actions."""
    return {
        "actions": [a.value for a in AuditAction],
        "categories": [c.value for c in AuditCategory],
        "severities": [s.value for s in AuditSeverity],
    }
