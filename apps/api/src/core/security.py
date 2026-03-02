"""
Security module - Authentication and Authorization.

JWT-based authentication with password hashing.
"""
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.models.user import User, UserRole
from src.models.enterprise_auth import ROLE_PERMISSIONS, RolePermissionOverride

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Bearer token (required)
security = HTTPBearer()
# Optional Bearer for endpoints that work with or without auth (e.g. BCP demo)
security_optional = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.access_token_expire_minutes
        )
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    return encoded_jwt


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Get current authenticated user from JWT token.
    
    Raises HTTPException if token is invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    result = await db.execute(
        select(User).where(User.id == UUID(user_id))
    )
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    
    return user


def resolve_user_id_from_token(token: Optional[str]) -> Optional[str]:
    """
    Extract user_id (sub) from JWT token string. For WebSocket query param auth.
    Returns None if token is absent or invalid. Does not hit DB.
    """
    if not token:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
        return payload.get("sub")
    except JWTError:
        return None


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current active user (additional check)."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    return current_user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    Return current user if valid Bearer token is present, else None.
    Use for endpoints that allow both authenticated and unauthenticated access (e.g. BCP).
    """
    if not credentials:
        return None
    try:
        token = credentials.credentials
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    result = await db.execute(
        select(User).where(User.id == UUID(user_id))
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return None
    return user


def require_role(required_role: UserRole):
    """Dependency to require a specific role."""
    async def role_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if current_user.role != required_role and current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {required_role.value} role",
            )
        return current_user
    
    return role_checker


# Role dependencies
require_admin = require_role(UserRole.ADMIN)
require_analyst = require_role(UserRole.ANALYST)


def require_permission(permission: str):
    """FastAPI dependency: require the current user to have the given permission (RBAC)."""
    async def _check(
        current_user: User = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        base_perms = set(ROLE_PERMISSIONS.get(current_user.role, []))
        result = await db.execute(
            select(RolePermissionOverride).where(RolePermissionOverride.user_id == current_user.id)
        )
        for o in result.scalars().all():
            if o.granted:
                base_perms.add(o.permission)
            else:
                base_perms.discard(o.permission)
        if permission not in base_perms and "admin:all" not in base_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission}",
            )
        return current_user
    return _check
