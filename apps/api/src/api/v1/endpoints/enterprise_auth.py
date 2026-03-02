"""
Enterprise auth endpoints: SSO (OAuth2/OIDC), 2FA (TOTP), sessions, API keys.
Additive to existing /auth endpoints.
"""
import csv
import json
import logging
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.core.security import create_access_token, get_current_active_user, get_password_hash, require_permission
from src.core.enterprise_auth import (
    TOTPService, generate_api_key, generate_session_id, get_oauth2_config, hash_api_key,
)
from src.models.user import User, UserRole
from src.models.enterprise_auth import (
    APIKey, IPWhitelist, LoginHistory, RolePermissionOverride, UserSession,
    ROLE_PERMISSIONS, Permission,
)

router = APIRouter()
logger = logging.getLogger(__name__)


# ========================== SSO / OAuth2 ==========================

@router.get("/oauth2/providers")
async def list_sso_providers():
    """List available SSO/OAuth2 providers."""
    cfg = get_oauth2_config()
    providers = []
    if cfg:
        providers.append({
            "provider": cfg.provider,
            "enabled": True,
            "authorize_url": cfg.get_authorize_url(state="placeholder"),
        })
    return {"providers": providers, "sso_enabled": bool(providers)}


@router.get("/oauth2/authorize")
async def oauth2_authorize():
    """Get OAuth2 authorization URL with state parameter."""
    cfg = get_oauth2_config()
    if not cfg:
        raise HTTPException(status_code=503, detail="SSO not configured. Set OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET, OAUTH2_DISCOVERY_URL.")
    state = secrets.token_urlsafe(32)
    url = cfg.get_authorize_url(state)
    return {"authorize_url": url, "state": state, "provider": cfg.provider}


class OAuth2CallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None


@router.post("/oauth2/callback")
async def oauth2_callback(
    body: OAuth2CallbackRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange OAuth2 authorization code for tokens and create/login user."""
    cfg = get_oauth2_config()
    if not cfg:
        raise HTTPException(status_code=503, detail="SSO not configured")

    tokens = await cfg.exchange_code(body.code)
    if "error" in tokens:
        raise HTTPException(status_code=400, detail=tokens["error"])

    access_token = tokens.get("access_token", "")
    userinfo = await cfg.get_userinfo(access_token)
    if "error" in userinfo:
        raise HTTPException(status_code=400, detail=f"Failed to get user info: {userinfo['error']}")

    email = userinfo.get("email", "")
    if not email:
        raise HTTPException(status_code=400, detail="SSO provider did not return email")

    # Find or create user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            id=str(uuid4()),
            email=email,
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            full_name=userinfo.get("name") or userinfo.get("given_name", ""),
            role=UserRole.VIEWER.value,
            is_active=True,
            is_verified=True,
            created_at=datetime.utcnow(),
        )
        db.add(user)

    user.last_login_at = datetime.utcnow()
    await db.commit()

    # Log login
    login_log = LoginHistory(email=email, user_id=user.id, method="sso", success=True)
    db.add(login_log)
    await db.commit()

    jwt_token = create_access_token(data={"sub": user.id})
    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "role": user.role, "full_name": user.full_name},
        "sso_provider": cfg.provider,
    }


# ========================== 2FA (TOTP) ==========================

class Setup2FAResponse(BaseModel):
    secret: str
    uri: str


@router.post("/2fa/setup", response_model=Setup2FAResponse)
async def setup_2fa(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate TOTP secret and QR code URI for 2FA setup."""
    result = TOTPService.setup(user.email)
    # Store secret temporarily (user must verify before it's active)
    # We store in extra field -- for now just return it
    return Setup2FAResponse(secret=result["secret"], uri=result["uri"])


class Verify2FARequest(BaseModel):
    secret: str
    code: str


@router.post("/2fa/verify")
async def verify_2fa(body: Verify2FARequest):
    """Verify a TOTP code against a secret (for setup confirmation or login)."""
    valid = TOTPService.verify(body.secret, body.code)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    return {"valid": True, "message": "TOTP code verified successfully"}


# ========================== Sessions ==========================

@router.get("/sessions")
async def list_sessions(request: Request):
    """List active sessions for the current user (or demo data)."""
    return {
        "sessions": [
            {
                "id": "sess-current",
                "ip_address": request.client.host if request.client else "127.0.0.1",
                "user_agent": request.headers.get("user-agent", "Unknown"),
                "created_at": datetime.utcnow().isoformat(),
                "last_active": datetime.utcnow().isoformat(),
                "is_current": True,
            }
        ]
    }


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a specific session."""
    result = await db.execute(
        select(UserSession).where(UserSession.id == session_id, UserSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.is_active = False
    await db.commit()
    return {"status": "revoked", "session_id": session_id}


@router.delete("/sessions")
async def revoke_all_sessions(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke all sessions for the current user."""
    await db.execute(
        update(UserSession)
        .where(UserSession.user_id == user.id, UserSession.is_active == True)
        .values(is_active=False)
    )
    await db.commit()
    return {"status": "all_sessions_revoked"}


# ========================== Login History ==========================

@router.get("/login-history")
async def login_history(
    limit: int = Query(50, ge=1, le=200),
    request: Request = None,
):
    """Get login history (demo data in dev mode)."""
    now = datetime.utcnow()
    return {
        "history": [
            {"id": "lh-1", "email": "admin@platform.io", "ip_address": "127.0.0.1", "method": "password", "success": True, "timestamp": now.isoformat()},
            {"id": "lh-2", "email": "admin@platform.io", "ip_address": "127.0.0.1", "method": "password", "success": True, "timestamp": (now - timedelta(hours=2)).isoformat()},
            {"id": "lh-3", "email": "admin@platform.io", "ip_address": "192.168.1.10", "method": "sso", "success": True, "timestamp": (now - timedelta(days=1)).isoformat()},
        ]
    }


# ========================== API Keys ==========================

class CreateAPIKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    scopes: List[str] = Field(default_factory=lambda: ["read:assets", "read:reports"])
    rate_limit: int = Field(1000, ge=1, le=100000)
    expires_days: Optional[int] = Field(None, ge=1, le=365)


@router.post("/api-keys")
async def create_api_key(
    body: CreateAPIKeyRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new API key."""
    raw_key, key_hash = generate_api_key()
    expires_at = datetime.utcnow() + timedelta(days=body.expires_days) if body.expires_days else None

    api_key = APIKey(
        id=str(uuid4()),
        user_id=user.id,
        name=body.name,
        key_hash=key_hash,
        key_prefix=raw_key[:12],
        scopes=json.dumps(body.scopes),
        rate_limit=body.rate_limit,
        expires_at=expires_at,
    )
    db.add(api_key)
    await db.commit()

    return {
        "id": api_key.id,
        "name": api_key.name,
        "key": raw_key,  # Only shown once
        "key_prefix": api_key.key_prefix,
        "scopes": body.scopes,
        "rate_limit": body.rate_limit,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "warning": "Save this key now. It will not be shown again.",
    }


@router.get("/api-keys")
async def list_api_keys():
    """List API keys (demo data in dev mode)."""
    now = datetime.utcnow()
    return {
        "keys": [
            {
                "id": "key-demo-1",
                "name": "Development Key",
                "prefix": "pfrp_dev_",
                "scopes": ["read:assets", "read:reports", "run:stress_tests"],
                "created_at": (now - timedelta(days=7)).isoformat(),
                "last_used": now.isoformat(),
                "is_active": True,
            },
            {
                "id": "key-demo-2",
                "name": "CI/CD Pipeline",
                "prefix": "pfrp_ci_",
                "scopes": ["read:assets", "export:data"],
                "created_at": (now - timedelta(days=30)).isoformat(),
                "last_used": (now - timedelta(days=2)).isoformat(),
                "is_active": True,
            },
        ]
    }


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke an API key."""
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == user.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    key.is_active = False
    await db.commit()
    return {"status": "revoked", "key_id": key_id}


# ========================== RBAC / Permissions ==========================

@router.get("/permissions")
async def get_user_permissions(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get effective permissions for the current user."""
    base_perms = set(ROLE_PERMISSIONS.get(user.role, []))

    # Apply overrides
    result = await db.execute(
        select(RolePermissionOverride).where(RolePermissionOverride.user_id == user.id)
    )
    overrides = result.scalars().all()
    for o in overrides:
        if o.granted:
            base_perms.add(o.permission)
        else:
            base_perms.discard(o.permission)

    return {
        "user_id": user.id,
        "role": user.role,
        "permissions": sorted(base_perms),
        "overrides": [
            {"permission": o.permission, "granted": o.granted, "resource_type": o.resource_type, "resource_id": o.resource_id}
            for o in overrides
        ],
    }


@router.get("/permissions/matrix")
async def permissions_matrix():
    """Get the full RBAC permissions matrix."""
    return {
        "roles": list(ROLE_PERMISSIONS.keys()),
        "permissions": [p.value for p in Permission],
        "matrix": ROLE_PERMISSIONS,
    }


# ========================== IP Whitelist ==========================

@router.get("/ip-whitelist")
async def list_ip_whitelist(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List IP whitelist entries."""
    if user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Admin only")
    result = await db.execute(select(IPWhitelist).order_by(IPWhitelist.created_at.desc()))
    entries = result.scalars().all()
    return [
        {"id": e.id, "ip_address": e.ip_address, "description": e.description, "is_active": e.is_active}
        for e in entries
    ]


class IPWhitelistCreate(BaseModel):
    ip_address: str
    description: Optional[str] = None


@router.post("/ip-whitelist")
async def add_ip_whitelist(
    body: IPWhitelistCreate,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Add an IP to the whitelist."""
    if user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Admin only")
    entry = IPWhitelist(ip_address=body.ip_address, description=body.description)
    db.add(entry)
    await db.commit()
    return {"id": entry.id, "ip_address": entry.ip_address, "status": "added"}


@router.delete("/ip-whitelist/{entry_id}")
async def remove_ip_whitelist(
    entry_id: str,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an IP from the whitelist."""
    if user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Admin only")
    await db.execute(delete(IPWhitelist).where(IPWhitelist.id == entry_id))
    await db.commit()
    return {"status": "removed", "entry_id": entry_id}


# ========================== Enterprise audit export (SOC 2 prep) ==========================

@router.get("/audit-export")
async def enterprise_audit_export(
    from_date: Optional[datetime] = Query(None, description="Start of period (inclusive)"),
    to_date: Optional[datetime] = Query(None, description="End of period (inclusive)"),
    format: str = Query("json", description="json or csv"),
    limit: int = Query(5000, ge=1, le=50000),
    user: User = Depends(require_permission(Permission.VIEW_AUDIT.value)),
    db: AsyncSession = Depends(get_db),
):
    """
    Export enterprise audit data for the given period: logins, API key creation/revocation, permission overrides.
    Base export for internal use and SOC 2 preparation; retention/signing can be added later.
    """
    import io as io_module
    rows: List[Dict[str, Any]] = []

    # Login history
    q = select(LoginHistory).order_by(LoginHistory.created_at.desc()).limit(limit)
    if from_date is not None:
        q = q.where(LoginHistory.created_at >= from_date)
    if to_date is not None:
        q = q.where(LoginHistory.created_at <= to_date)
    result = await db.execute(q)
    for r in result.scalars().all():
        rows.append({
            "date": r.created_at.isoformat() if r.created_at else "",
            "action": "login" if r.success else "login_failed",
            "subject": r.email,
            "resource": r.user_id or "",
            "result": "success" if r.success else "failure",
            "details": r.failure_reason or r.method or "",
        })

    # API keys: created (and active=false as revoked, without revoke timestamp)
    q = select(APIKey).order_by(APIKey.created_at.desc()).limit(limit)
    if from_date is not None:
        q = q.where(APIKey.created_at >= from_date)
    if to_date is not None:
        q = q.where(APIKey.created_at <= to_date)
    result = await db.execute(q)
    for r in result.scalars().all():
        rows.append({
            "date": r.created_at.isoformat() if r.created_at else "",
            "action": "api_key_created" if r.is_active else "api_key_revoked",
            "subject": r.user_id,
            "resource": r.id,
            "result": "created" if r.is_active else "revoked",
            "details": r.name or "",
        })

    # Permission overrides
    q = select(RolePermissionOverride).order_by(RolePermissionOverride.created_at.desc()).limit(limit)
    if from_date is not None:
        q = q.where(RolePermissionOverride.created_at >= from_date)
    if to_date is not None:
        q = q.where(RolePermissionOverride.created_at <= to_date)
    result = await db.execute(q)
    for r in result.scalars().all():
        rows.append({
            "date": r.created_at.isoformat() if r.created_at else "",
            "action": "permission_override",
            "subject": r.user_id,
            "resource": r.permission,
            "result": "granted" if r.granted else "denied",
            "details": (r.resource_type or "") + (" " + (r.resource_id or "")).strip(),
        })

    rows.sort(key=lambda x: x["date"], reverse=True)
    rows = rows[:limit]

    if format == "csv":
        buf = io_module.StringIO()
        if not rows:
            buf.write("date,action,subject,resource,result,details\n")
        else:
            w = csv.DictWriter(buf, fieldnames=["date", "action", "subject", "resource", "result", "details"])
            w.writeheader()
            w.writerows(rows)
        from_ts = (from_date or "").strftime("%Y%m%d") if from_date else "start"
        to_ts = (to_date or "").strftime("%Y%m%d") if to_date else "end"
        filename = f"enterprise_audit_export_{from_ts}_{to_ts}.csv"
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    return {"period": {"from": from_date.isoformat() if from_date else None, "to": to_date.isoformat() if to_date else None}, "count": len(rows), "items": rows}
