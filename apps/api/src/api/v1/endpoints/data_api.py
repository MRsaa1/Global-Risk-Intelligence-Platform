"""
Data API for B2B (insurers, REITs): read-only risk data.

Protected by API key with scope read:data_api or b2b:data, or JWT with permission read:data_api.
All endpoints are GET-only.
"""
import json
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.enterprise_auth import hash_api_key
from src.core.security import get_current_user
from src.models.enterprise_auth import APIKey, Permission, ROLE_PERMISSIONS, RolePermissionOverride
from src.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()
_DATA_API_SCOPES = ("read:data_api", "b2b:data")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
_bearer_optional = HTTPBearer(auto_error=False)


async def get_data_api_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_optional),
    api_key_raw: Optional[str] = Depends(_api_key_header),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Require either: Bearer JWT with permission read:data_api (or b2b:data), or X-API-Key with scope read:data_api or b2b:data.
    """
    if credentials:
        try:
            user = await get_current_user(credentials, db)
            base = set(ROLE_PERMISSIONS.get(user.role, []))
            r = await db.execute(select(RolePermissionOverride).where(RolePermissionOverride.user_id == user.id))
            for o in r.scalars().all():
                if o.granted:
                    base.add(o.permission)
                else:
                    base.discard(o.permission)
            if Permission.READ_DATA_API.value not in base and Permission.B2B_DATA.value not in base and "admin:all" not in base:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission required: read:data_api or b2b:data")
            return user
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("Data API JWT auth failed: %s", e)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or insufficient credentials")
    if api_key_raw and api_key_raw.strip():
        key_hash = hash_api_key(api_key_raw.strip())
        result = await db.execute(
            select(APIKey).where(APIKey.key_hash == key_hash, APIKey.is_active == True)
        )
        key = result.scalar_one_or_none()
        if not key:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")
        scopes = []
        if key.scopes:
            try:
                scopes = json.loads(key.scopes) if isinstance(key.scopes, str) else key.scopes
            except (TypeError, ValueError):
                pass
        if not any(s in _DATA_API_SCOPES for s in scopes):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="API key missing scope: read:data_api or b2b:data")
        result = await db.execute(select(User).where(User.id == key.user_id))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="API key user inactive")
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Missing Authorization (Bearer) or X-API-Key with scope read:data_api or b2b:data",
    )


def _base_url(request: Request) -> str:
    return str(request.base_url).rstrip("/")


@router.get("/city-risks")
async def get_city_risks(
    request: Request,
    city: Optional[str] = Query(None, description="Community id, e.g. bastrop_tx"),
    _user: User = Depends(get_data_api_user),
):
    """Read-only city/community risk (proxy to CADAPT community/risk)."""
    base = _base_url(request)
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{base}/api/v1/cadapt/community/risk", params={"city": city} if city else {})
    r.raise_for_status()
    return r.json()


@router.get("/disclosure")
async def get_disclosure(
    request: Request,
    city: Optional[str] = Query(None, description="Municipality id"),
    export_format: Optional[str] = Query("municipal_schema_v1", description="Export format"),
    _user: User = Depends(get_data_api_user),
):
    """Read-only disclosure export (proxy to CADAPT disclosure-export)."""
    base = _base_url(request)
    params = {}
    if city:
        params["city"] = city
    if export_format:
        params["format"] = export_format
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{base}/api/v1/cadapt/disclosure-export", params=params)
    r.raise_for_status()
    return r.json()


@router.get("/stress-results")
async def list_stress_results(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _user: User = Depends(get_data_api_user),
):
    """List stress test results (read-only, proxy to stress-tests)."""
    base = _base_url(request)
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{base}/api/v1/stress-tests", params={"skip": skip, "limit": limit})
    r.raise_for_status()
    return r.json()


@router.get("/stress-results/{test_id}")
async def get_stress_result(
    request: Request,
    test_id: str,
    _user: User = Depends(get_data_api_user),
):
    """Get a single stress test result by id (read-only)."""
    base = _base_url(request)
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{base}/api/v1/stress-tests/{test_id}")
    r.raise_for_status()
    return r.json()
