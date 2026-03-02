"""Enterprise auth models: sessions, permissions, API keys, login history."""
import enum
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class Permission(str, enum.Enum):
    """Granular permissions for RBAC."""
    READ_ASSETS = "read:assets"
    WRITE_ASSETS = "write:assets"
    DELETE_ASSETS = "delete:assets"
    READ_REPORTS = "read:reports"
    WRITE_REPORTS = "write:reports"
    RUN_STRESS_TESTS = "run:stress_tests"
    MANAGE_USERS = "manage:users"
    MANAGE_SETTINGS = "manage:settings"
    ACCESS_MODULES = "access:modules"
    EXPORT_DATA = "export:data"
    IMPORT_DATA = "import:data"
    VIEW_AUDIT = "view:audit"
    MANAGE_API_KEYS = "manage:api_keys"
    ADMIN_ALL = "admin:all"
    # B2B Data API (read-only risk data for insurers/REITs)
    READ_DATA_API = "read:data_api"
    B2B_DATA = "b2b:data"


# Default permission sets per role
ROLE_PERMISSIONS = {
    "admin": [p.value for p in Permission],
    "analyst": [
        Permission.READ_ASSETS.value, Permission.WRITE_ASSETS.value,
        Permission.READ_REPORTS.value, Permission.WRITE_REPORTS.value,
        Permission.RUN_STRESS_TESTS.value, Permission.ACCESS_MODULES.value,
        Permission.EXPORT_DATA.value, Permission.VIEW_AUDIT.value,
    ],
    "viewer": [
        Permission.READ_ASSETS.value, Permission.READ_REPORTS.value,
        Permission.ACCESS_MODULES.value,
    ],
    "api": [
        Permission.READ_ASSETS.value, Permission.READ_REPORTS.value,
        Permission.EXPORT_DATA.value, Permission.READ_DATA_API.value,
    ],
}


class UserSession(Base):
    """Active user session for session management."""
    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(String(512))
    device_info: Mapped[Optional[str]] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_active_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


class LoginHistory(Base):
    """Login attempt history for audit."""
    __tablename__ = "login_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(String(512))
    method: Mapped[str] = mapped_column(String(20), default="password")  # password, sso, api_key, totp
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    failure_reason: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class APIKey(Base):
    """API key for programmatic access."""
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String(12))  # first 8 chars for identification
    scopes: Mapped[Optional[str]] = mapped_column(Text)  # JSON array of permissions
    rate_limit: Mapped[int] = mapped_column(Integer, default=1000)  # requests per minute
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RolePermissionOverride(Base):
    """Per-user permission overrides (grant or deny specific permissions)."""
    __tablename__ = "role_permission_overrides"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    permission: Mapped[str] = mapped_column(String(50), nullable=False)
    granted: Mapped[bool] = mapped_column(Boolean, default=True)  # True=grant, False=deny
    resource_type: Mapped[Optional[str]] = mapped_column(String(50))  # e.g. "module", "portfolio"
    resource_id: Mapped[Optional[str]] = mapped_column(String(36))  # specific resource
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class IPWhitelist(Base):
    """IP whitelist for organization-level access control."""
    __tablename__ = "ip_whitelist"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
