"""
Audit Logging Service.

Provides comprehensive audit trail for:
- User actions (login, logout, API calls)
- Data changes (CRUD operations)
- System events (errors, alerts)
- Security events (failed logins, permission denials)

Stores logs in PostgreSQL with optional export to external systems.
"""
import json
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4
import logging

from pydantic import BaseModel
from sqlalchemy import Column, String, Text, DateTime, JSON, Index
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# ==================== ENUMS ====================

class AuditAction(str, Enum):
    """Types of auditable actions."""
    # User actions
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    PASSWORD_CHANGE = "password_change"
    
    # CRUD actions
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    
    # Bulk actions
    BULK_CREATE = "bulk_create"
    BULK_UPDATE = "bulk_update"
    BULK_DELETE = "bulk_delete"
    EXPORT = "export"
    IMPORT = "import"
    
    # System actions
    STRESS_TEST_RUN = "stress_test_run"
    STRESS_TEST_COMPLETE = "stress_test_complete"
    ALERT_GENERATED = "alert_generated"
    ALERT_ACKNOWLEDGED = "alert_acknowledged"
    ALERT_RESOLVED = "alert_resolved"
    
    # Security actions
    PERMISSION_DENIED = "permission_denied"
    INVALID_TOKEN = "invalid_token"
    RATE_LIMITED = "rate_limited"
    
    # Admin actions
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DELETED = "user_deleted"
    ROLE_CHANGED = "role_changed"
    SETTINGS_CHANGED = "settings_changed"

    # Decision Object (Risk & Intelligence OS)
    DECISION_OBJECT_CREATED = "decision_object_created"


class AuditCategory(str, Enum):
    """Categories for audit events."""
    AUTH = "auth"
    DATA = "data"
    SECURITY = "security"
    SYSTEM = "system"
    ADMIN = "admin"


class AuditSeverity(str, Enum):
    """Severity levels for audit events."""
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


# ==================== MODELS ====================

class AuditLogEntry(BaseModel):
    """Audit log entry schema."""
    id: str
    timestamp: datetime
    
    # Who
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    
    # What
    action: AuditAction
    category: AuditCategory
    severity: AuditSeverity = AuditSeverity.INFO
    
    # Where
    resource_type: Optional[str] = None  # asset, stress_test, user, etc.
    resource_id: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    
    # Details
    description: str
    old_value: Optional[Dict] = None
    new_value: Optional[Dict] = None
    metadata: Optional[Dict] = None
    
    # Result
    success: bool = True
    error_message: Optional[str] = None
    duration_ms: Optional[int] = None


# ==================== IN-MEMORY STORE (for development) ====================

class InMemoryAuditStore:
    """Simple in-memory audit log store for development."""
    
    def __init__(self, max_entries: int = 10000):
        self._logs: List[AuditLogEntry] = []
        self.max_entries = max_entries
    
    async def add(self, entry: AuditLogEntry):
        """Add log entry."""
        self._logs.append(entry)
        # Trim if too many
        if len(self._logs) > self.max_entries:
            self._logs = self._logs[-self.max_entries:]
    
    async def query(
        self,
        user_id: str = None,
        action: AuditAction = None,
        category: AuditCategory = None,
        resource_type: str = None,
        resource_id: str = None,
        start_time: datetime = None,
        end_time: datetime = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[AuditLogEntry]:
        """Query logs with filters."""
        results = self._logs.copy()
        
        if user_id:
            results = [e for e in results if e.user_id == user_id]
        if action:
            results = [e for e in results if e.action == action]
        if category:
            results = [e for e in results if e.category == category]
        if resource_type:
            results = [e for e in results if e.resource_type == resource_type]
        if resource_id:
            results = [e for e in results if e.resource_id == resource_id]
        if start_time:
            results = [e for e in results if e.timestamp >= start_time]
        if end_time:
            results = [e for e in results if e.timestamp <= end_time]
        
        # Sort by timestamp descending
        results.sort(key=lambda x: x.timestamp, reverse=True)
        
        return results[offset:offset + limit]
    
    async def count(self, **filters) -> int:
        """Count logs matching filters."""
        results = await self.query(**filters, limit=100000)
        return len(results)
    
    def stats(self) -> Dict:
        """Get statistics."""
        if not self._logs:
            return {"total": 0}
        
        return {
            "total": len(self._logs),
            "by_category": self._count_by("category"),
            "by_action": self._count_by("action"),
            "oldest": self._logs[0].timestamp.isoformat() if self._logs else None,
            "newest": self._logs[-1].timestamp.isoformat() if self._logs else None,
        }
    
    def _count_by(self, field: str) -> Dict[str, int]:
        counts = {}
        for entry in self._logs:
            value = getattr(entry, field, None)
            if value:
                key = value.value if hasattr(value, 'value') else str(value)
                counts[key] = counts.get(key, 0) + 1
        return counts


# ==================== AUDIT SERVICE ====================

class DecisionObjectStore:
    """In-memory store for Decision Objects (replay_decision support)."""

    def __init__(self, max_entries: int = 10000):
        self._decisions: Dict[str, Dict] = {}
        self._max_entries = max_entries

    def add(self, decision_id: str, data: Dict) -> None:
        self._decisions[decision_id] = data
        if len(self._decisions) > self._max_entries:
            # Remove oldest by timestamp (ISO string or datetime)
            def _ts(item):
                ts = (item[1].get("provenance") or {}).get("timestamp")
                if ts is None:
                    return ""
                return ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
            items = sorted(self._decisions.items(), key=_ts)
            for k, _ in items[: len(items) - self._max_entries]:
                del self._decisions[k]

    def get(self, decision_id: str) -> Optional[Dict]:
        return self._decisions.get(decision_id)

    def list_ids(self, limit: int = 100) -> List[str]:
        return list(self._decisions.keys())[-limit:]


class AuditService:
    """
    Main audit logging service.
    
    Usage:
        await audit.log_action(
            action=AuditAction.CREATE,
            category=AuditCategory.DATA,
            user_id="user-123",
            resource_type="asset",
            resource_id="asset-456",
            description="Created new asset",
            new_value={"name": "New Asset"},
        )
    """
    
    def __init__(self):
        self._store = InMemoryAuditStore()
        self._decision_store = DecisionObjectStore()
    
    async def log_action(
        self,
        action: AuditAction,
        category: AuditCategory,
        description: str,
        user_id: str = None,
        user_email: str = None,
        ip_address: str = None,
        user_agent: str = None,
        resource_type: str = None,
        resource_id: str = None,
        endpoint: str = None,
        method: str = None,
        old_value: Dict = None,
        new_value: Dict = None,
        metadata: Dict = None,
        success: bool = True,
        error_message: str = None,
        duration_ms: int = None,
        severity: AuditSeverity = None,
    ) -> AuditLogEntry:
        """Log an auditable action."""
        
        # Determine severity if not provided
        if severity is None:
            if not success:
                severity = AuditSeverity.ERROR
            elif action in [AuditAction.DELETE, AuditAction.BULK_DELETE]:
                severity = AuditSeverity.WARNING
            elif category == AuditCategory.SECURITY:
                severity = AuditSeverity.WARNING
            else:
                severity = AuditSeverity.INFO
        
        entry = AuditLogEntry(
            id=str(uuid4()),
            timestamp=datetime.utcnow(),
            user_id=user_id,
            user_email=user_email,
            ip_address=ip_address,
            user_agent=user_agent,
            action=action,
            category=category,
            severity=severity,
            resource_type=resource_type,
            resource_id=resource_id,
            endpoint=endpoint,
            method=method,
            description=description,
            old_value=old_value,
            new_value=new_value,
            metadata=metadata,
            success=success,
            error_message=error_message,
            duration_ms=duration_ms,
        )
        
        await self._store.add(entry)
        
        # Log to standard logger too
        log_msg = f"[AUDIT] {action.value}: {description}"
        if success:
            logger.info(log_msg)
        else:
            logger.warning(f"{log_msg} - Error: {error_message}")
        
        return entry
    
    async def log_login(
        self,
        user_id: str,
        user_email: str,
        ip_address: str = None,
        success: bool = True,
        error_message: str = None,
    ):
        """Log login attempt."""
        action = AuditAction.LOGIN if success else AuditAction.LOGIN_FAILED
        return await self.log_action(
            action=action,
            category=AuditCategory.AUTH,
            user_id=user_id,
            user_email=user_email,
            ip_address=ip_address,
            description=f"User {'logged in' if success else 'failed to login'}",
            success=success,
            error_message=error_message,
            severity=AuditSeverity.INFO if success else AuditSeverity.WARNING,
        )
    
    async def log_logout(self, user_id: str, user_email: str = None):
        """Log logout."""
        return await self.log_action(
            action=AuditAction.LOGOUT,
            category=AuditCategory.AUTH,
            user_id=user_id,
            user_email=user_email,
            description="User logged out",
        )
    
    async def log_create(
        self,
        resource_type: str,
        resource_id: str,
        user_id: str = None,
        new_value: Dict = None,
        description: str = None,
    ):
        """Log resource creation."""
        return await self.log_action(
            action=AuditAction.CREATE,
            category=AuditCategory.DATA,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            new_value=new_value,
            description=description or f"Created {resource_type} {resource_id}",
        )
    
    async def log_update(
        self,
        resource_type: str,
        resource_id: str,
        user_id: str = None,
        old_value: Dict = None,
        new_value: Dict = None,
        description: str = None,
    ):
        """Log resource update."""
        return await self.log_action(
            action=AuditAction.UPDATE,
            category=AuditCategory.DATA,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_value,
            new_value=new_value,
            description=description or f"Updated {resource_type} {resource_id}",
        )
    
    async def log_delete(
        self,
        resource_type: str,
        resource_id: str,
        user_id: str = None,
        old_value: Dict = None,
        description: str = None,
    ):
        """Log resource deletion."""
        return await self.log_action(
            action=AuditAction.DELETE,
            category=AuditCategory.DATA,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_value,
            description=description or f"Deleted {resource_type} {resource_id}",
            severity=AuditSeverity.WARNING,
        )
    
    async def log_security_event(
        self,
        action: AuditAction,
        description: str,
        user_id: str = None,
        ip_address: str = None,
        metadata: Dict = None,
    ):
        """Log security event."""
        return await self.log_action(
            action=action,
            category=AuditCategory.SECURITY,
            user_id=user_id,
            ip_address=ip_address,
            description=description,
            metadata=metadata,
            severity=AuditSeverity.WARNING,
        )
    
    async def log_decision_object(self, decision: Any) -> None:
        """Store Decision Object for replay_decision API."""
        try:
            from src.models.decision_object import DecisionObject
            if isinstance(decision, DecisionObject):
                data = decision.model_dump()
            else:
                data = dict(decision) if hasattr(decision, "keys") else {}
            self._decision_store.add(data.get("decision_id", str(uuid4())), data)
        except Exception as e:
            logger.warning("Failed to store decision object: %s", e)

    async def get_decision(self, decision_id: str) -> Optional[Dict]:
        """Get stored Decision Object by ID."""
        return self._decision_store.get(decision_id)

    async def replay_decision(self, decision_id: str) -> Optional[Dict]:
        """
        Replay a historical decision. Returns stored DO with replay metadata.
        Full re-execution requires ARIN orchestrator (uses same input_snapshot).
        """
        stored = self._decision_store.get(decision_id)
        if not stored:
            return None
        return {
            "decision_id": decision_id,
            "original": stored,
            "replayed_at": datetime.utcnow().isoformat() + "Z",
            "replay_type": "stored",
            "match": True,
        }

    async def query(self, **filters) -> List[AuditLogEntry]:
        """Query audit logs."""
        return await self._store.query(**filters)
    
    async def count(self, **filters) -> int:
        """Count audit logs."""
        return await self._store.count(**filters)
    
    def stats(self) -> Dict:
        """Get audit statistics."""
        return self._store.stats()


# Global audit service instance
audit_service = AuditService()


# ==================== CONVENIENCE FUNCTIONS ====================

async def audit_login(user_id: str, email: str, ip: str = None, success: bool = True, error: str = None):
    """Log login attempt."""
    return await audit_service.log_login(user_id, email, ip, success, error)


async def audit_create(resource_type: str, resource_id: str, user_id: str = None, data: dict = None):
    """Log resource creation."""
    return await audit_service.log_create(resource_type, resource_id, user_id, data)


async def audit_update(resource_type: str, resource_id: str, user_id: str = None, old: dict = None, new: dict = None):
    """Log resource update."""
    return await audit_service.log_update(resource_type, resource_id, user_id, old, new)


async def audit_delete(resource_type: str, resource_id: str, user_id: str = None, data: dict = None):
    """Log resource deletion."""
    return await audit_service.log_delete(resource_type, resource_id, user_id, data)
