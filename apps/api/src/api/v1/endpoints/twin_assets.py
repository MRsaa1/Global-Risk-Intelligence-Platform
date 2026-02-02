"""Digital Twin Asset Library endpoints (catalog of USD masters + web derivatives)."""

import json
from datetime import datetime
from typing import Optional
from uuid import uuid4

from io import BytesIO

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.core.storage import storage
from minio.error import S3Error
from src.models.asset import Asset
from src.models.digital_twin import DigitalTwin
from src.models.twin_asset_library import TwinAssetLibraryItem
from src.core.celery_app import celery_app
from celery.result import AsyncResult
from src.services.usd_to_glb import UsdToGlbUnavailable, convert_usd_bytes_to_glb
from src.services.nucleus_fetch import fetch_usd_bytes, NucleusFetchError
from src.services.glb_metadata import glb_triangle_count
from src.services.glb_optimize import optimize_glb_bytes

router = APIRouter()


def _split_bucket_path(p: str) -> tuple[str, str]:
    """Split 'bucket/object_name' into parts."""
    parts = p.split("/", 1)
    if len(parts) != 2:
        raise ValueError("Invalid storage path; expected 'bucket/object'")
    return parts[0], parts[1]


class TwinAssetCreate(BaseModel):
    domain: str = Field(default="factory")
    kind: str = Field(default="building")
    category: Optional[str] = Field(default=None, description="residential|commercial|industrial|public")
    name: str
    description: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    license: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    usd_path: Optional[str] = None
    glb_object: Optional[str] = None
    thumbnail_object: Optional[str] = None
    extra_metadata: Optional[dict] = None


class TwinAssetResponse(BaseModel):
    id: str
    domain: str
    kind: str
    category: Optional[str] = None
    name: str
    description: Optional[str]
    tags: list[str] = Field(default_factory=list)
    license: Optional[str]
    source: Optional[str]
    source_url: Optional[str]
    usd_path: Optional[str]
    glb_object: Optional[str]
    thumbnail_object: Optional[str]
    extra_metadata: Optional[dict]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


def _to_twin_asset_response(r: TwinAssetLibraryItem) -> TwinAssetResponse:
    """Convert ORM row → API response (parsing JSON text fields)."""
    try:
        tags = json.loads(r.tags) if r.tags else []
        if not isinstance(tags, list):
            tags = []
    except Exception:
        tags = []
    try:
        extra = json.loads(r.extra_metadata) if r.extra_metadata else None
        if extra is not None and not isinstance(extra, dict):
            extra = None
    except Exception:
        extra = None

    return TwinAssetResponse(
        id=str(r.id),
        domain=str(r.domain),
        kind=str(r.kind),
        category=getattr(r, "category", None),
        name=str(r.name),
        description=r.description,
        tags=[str(t) for t in tags],
        license=r.license,
        source=r.source,
        source_url=r.source_url,
        usd_path=r.usd_path,
        glb_object=r.glb_object,
        thumbnail_object=r.thumbnail_object,
        extra_metadata=extra,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


class AttachRequest(BaseModel):
    asset_id: str
    prefer: str = Field(default="glb")  # glb|usd


class ConvertRequest(BaseModel):
    """Trigger USD→GLB conversion for an item."""
    usd_ext: str = Field(default=".usd", description="USD extension hint (.usd/.usdc/.usda/.usdz)")
    overwrite: bool = False


class ConvertAsyncResponse(BaseModel):
    task_id: str
    status: str = "queued"
    item_id: str


@router.get("", response_model=list[TwinAssetResponse])
async def list_twin_assets(
    q: Optional[str] = None,
    domain: Optional[str] = None,
    kind: Optional[str] = None,
    category: Optional[str] = Query(default=None, description="residential|commercial|industrial|public"),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List catalog entries (simple filters)."""
    try:
        query = select(TwinAssetLibraryItem).order_by(TwinAssetLibraryItem.created_at.desc())
        if domain:
            query = query.where(TwinAssetLibraryItem.domain == domain)
        if kind:
            query = query.where(TwinAssetLibraryItem.kind == kind)
        if category:
            query = query.where(TwinAssetLibraryItem.category == category)
        if q:
            like = f"%{q}%"
            query = query.where(
                (TwinAssetLibraryItem.name.ilike(like)) | (TwinAssetLibraryItem.description.ilike(like))
            )
        query = query.limit(limit)
        res = await db.execute(query)
        rows = list(res.scalars().all())
        return [_to_twin_asset_response(r) for r in rows]
    except OperationalError as e:
        if "category" in str(e).lower() or "no such column" in str(e).lower():
            raise HTTPException(
                status_code=503,
                detail="Database schema outdated: missing twin_asset_library.category. Run: cd apps/api && alembic upgrade head",
            ) from e
        raise


@router.post("", response_model=TwinAssetResponse, status_code=201)
async def create_twin_asset(
    data: TwinAssetCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new catalog entry (admin UI will call this later)."""
    item = TwinAssetLibraryItem(
        id=str(uuid4()),
        domain=data.domain,
        kind=data.kind,
        category=data.category,
        name=data.name,
        description=data.description,
        tags=json.dumps(data.tags) if data.tags else None,
        license=data.license,
        source=data.source,
        source_url=data.source_url,
        usd_path=data.usd_path,
        glb_object=data.glb_object,
        thumbnail_object=data.thumbnail_object,
        extra_metadata=json.dumps(data.extra_metadata) if data.extra_metadata else None,
        created_at=datetime.utcnow(),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _to_twin_asset_response(item)


@router.post("/upload", response_model=TwinAssetResponse, status_code=201)
async def upload_twin_asset_glb(
    file: UploadFile = File(...),
    name: str = Form(...),
    category: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: str = Form(""),
    license: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
    source_url: Optional[str] = Form(None),
    optimize: bool = Form(False),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a GLB file to the Digital Twin Library (multipart).
    Optionally optimize with gltf-transform; stores file in MinIO and creates a catalog entry.
    """
    file_ext = "." + (file.filename or "").split(".")[-1].lower() if "." in (file.filename or "") else ""
    if file_ext != ".glb":
        raise HTTPException(status_code=400, detail="Only .glb files are accepted")

    content = await file.read()
    file_size = len(content)
    glb_bytes = content

    if optimize:
        optimized = optimize_glb_bytes(glb_bytes)
        if optimized is not None:
            glb_bytes = optimized
            file_size = len(glb_bytes)

    if not storage.is_available:
        raise HTTPException(status_code=503, detail="Object storage unavailable")

    item_id = str(uuid4())
    object_name = f"twins/library/{item_id}/model.glb"
    try:
        glb_path = storage.upload_file(
            settings.minio_bucket_assets,
            object_name,
            BytesIO(glb_bytes),
            content_type="model/gltf-binary",
            metadata={"twin_asset_library_id": item_id},
        )
    except S3Error:
        raise HTTPException(status_code=503, detail="Object storage unavailable")

    poly_count = glb_triangle_count(glb_bytes)
    extra = {"file_size_bytes": file_size}
    if poly_count is not None:
        extra["poly_count"] = poly_count
    extra_metadata = json.dumps(extra)

    tags_list: list[str] = []
    if tags.strip():
        try:
            parsed = json.loads(tags.strip())
            tags_list = [str(x) for x in parsed] if isinstance(parsed, list) else [t.strip() for t in tags.split(",") if t.strip()]
        except Exception:
            tags_list = [t.strip() for t in tags.split(",") if t.strip()]

    item = TwinAssetLibraryItem(
        id=item_id,
        domain="other",
        kind="building",
        category=category or None,
        name=name,
        description=description or None,
        tags=json.dumps(tags_list) if tags_list else None,
        license=license,
        source=source,
        source_url=source_url,
        usd_path=None,
        glb_object=glb_path,
        thumbnail_object=None,
        extra_metadata=extra_metadata,
        created_at=datetime.utcnow(),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _to_twin_asset_response(item)


@router.get("/{item_id}", response_model=TwinAssetResponse)
async def get_twin_asset(item_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(TwinAssetLibraryItem).where(TwinAssetLibraryItem.id == item_id))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Catalog item not found")
    return _to_twin_asset_response(item)


@router.get("/{item_id}/glb-url")
async def get_glb_url(item_id: str, expires_hours: int = 2, db: AsyncSession = Depends(get_db)):
    """Get a presigned URL for the derived GLB (web), or the URL itself if external."""
    res = await db.execute(select(TwinAssetLibraryItem).where(TwinAssetLibraryItem.id == item_id))
    item = res.scalar_one_or_none()
    if not item or not item.glb_object:
        raise HTTPException(status_code=404, detail="GLB not available for this item")
    path = str(item.glb_object)
    if path.startswith(("http://", "https://")):
        return {"url": path}
    if not storage.is_available:
        raise HTTPException(status_code=503, detail="Object storage unavailable")
    bucket, object_name = _split_bucket_path(path)
    url = storage.get_presigned_url(bucket, object_name, expires_hours=expires_hours)
    return {"url": url, "bucket": bucket, "object": object_name}


@router.post("/{item_id}/attach")
async def attach_to_asset(item_id: str, req: AttachRequest, db: AsyncSession = Depends(get_db)):
    """Attach this library item to an Asset's DigitalTwin geometry pointer."""
    # Validate asset exists
    a_res = await db.execute(select(Asset).where(Asset.id == req.asset_id))
    asset = a_res.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Load item
    res = await db.execute(select(TwinAssetLibraryItem).where(TwinAssetLibraryItem.id == item_id))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Catalog item not found")

    # Ensure twin exists
    t_res = await db.execute(select(DigitalTwin).where(DigitalTwin.asset_id == req.asset_id))
    twin = t_res.scalar_one_or_none()
    if not twin:
        twin = DigitalTwin(
            asset_id=req.asset_id,
            created_at=datetime.utcnow(),
        )
        db.add(twin)
        await db.commit()
        await db.refresh(twin)

    prefer = (req.prefer or "glb").lower()
    if prefer == "glb" and item.glb_object:
        twin.geometry_type = "glb"
        twin.geometry_path = item.glb_object
    elif item.usd_path:
        twin.geometry_type = "usd"
        twin.geometry_path = item.usd_path
    else:
        raise HTTPException(status_code=400, detail="No compatible geometry for requested prefer")

    twin.geometry_metadata = json.dumps(
        {
            "twin_asset_library_id": item.id,
            "domain": item.domain,
            "kind": item.kind,
            "name": item.name,
        }
    )
    twin.updated_at = datetime.utcnow()
    await db.commit()

    return {
        "status": "attached",
        "asset_id": req.asset_id,
        "twin_asset_library_id": item.id,
        "geometry_type": twin.geometry_type,
        "geometry_path": twin.geometry_path,
    }


@router.post("/{item_id}/optimize", response_model=TwinAssetResponse)
async def optimize_twin_asset_glb(item_id: str, db: AsyncSession = Depends(get_db)):
    """
    Re-optimize an existing library item's GLB with gltf-transform (subprocess).
    Only items with GLB in MinIO are supported; external URLs are skipped.
    Updates extra_metadata (file_size_bytes, poly_count) after optimization.
    """
    res = await db.execute(select(TwinAssetLibraryItem).where(TwinAssetLibraryItem.id == item_id))
    item = res.scalar_one_or_none()
    if not item or not item.glb_object:
        raise HTTPException(status_code=404, detail="Catalog item or GLB not found")
    path = str(item.glb_object)
    if path.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=400,
            detail="Cannot optimize: item uses external URL; upload a local GLB to optimize",
        )
    if not storage.is_available:
        raise HTTPException(status_code=503, detail="Object storage unavailable")
    bucket, object_name = _split_bucket_path(path)
    try:
        glb_bytes = storage.download_file(bucket, object_name)
    except S3Error:
        raise HTTPException(status_code=404, detail="GLB object not found in storage")
    optimized = optimize_glb_bytes(glb_bytes)
    if optimized is None:
        raise HTTPException(
            status_code=503,
            detail="Optimization unavailable (npx and @gltf-transform/cli required)",
        )
    try:
        storage.upload_file(
            bucket,
            object_name,
            BytesIO(optimized),
            content_type="model/gltf-binary",
            metadata={"twin_asset_library_id": item.id},
        )
    except S3Error:
        raise HTTPException(status_code=503, detail="Object storage unavailable")
    file_size = len(optimized)
    poly_count = glb_triangle_count(optimized)
    try:
        extra = json.loads(item.extra_metadata) if item.extra_metadata else {}
    except Exception:
        extra = {}
    extra["file_size_bytes"] = file_size
    if poly_count is not None:
        extra["poly_count"] = poly_count
    item.extra_metadata = json.dumps(extra)
    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)
    return _to_twin_asset_response(item)


@router.post("/{item_id}/convert")
async def convert_usd_to_glb_for_item(
    item_id: str,
    req: ConvertRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Convert the USD master to a GLB derivative and upload to object storage.

    Notes:
    - Requires `usd2gltf` (and usd-core) installed in the API environment.
    - For Nucleus paths (omniverse:// or /Library/... on Nucleus), this endpoint
      expects the USD to be accessible either via object storage or local FS.
      Enterprise deployments typically run conversion inside Omniverse/Kit.
    """
    res = await db.execute(select(TwinAssetLibraryItem).where(TwinAssetLibraryItem.id == item_id))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Catalog item not found")
    if not item.usd_path:
        raise HTTPException(status_code=400, detail="This item has no usd_path")

    if item.glb_object and not req.overwrite:
        return {"status": "skipped", "message": "GLB already exists", "glb_object": item.glb_object}

    # Fetch USD bytes (supports MinIO/local mount/omniverse:// via optional client)
    try:
        usd_bytes = fetch_usd_bytes(item.usd_path)
    except NucleusFetchError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Convert
    try:
        glb_bytes = convert_usd_bytes_to_glb(usd_bytes, usd_ext=req.usd_ext)
    except UsdToGlbUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {e}")

    if not storage.is_available:
        raise HTTPException(status_code=503, detail="Object storage unavailable")

    object_name = f"twins/library/{item.id}/model.glb"
    try:
        glb_path = storage.upload_file(
            settings.minio_bucket_assets,
            object_name,
            BytesIO(glb_bytes),
            content_type="model/gltf-binary",
            metadata={"twin_asset_library_id": item.id},
        )
    except S3Error:
        raise HTTPException(status_code=503, detail="Object storage unavailable")

    item.glb_object = glb_path
    item.updated_at = datetime.utcnow()
    await db.commit()

    return {"status": "converted", "glb_object": glb_path, "bytes": len(glb_bytes)}


@router.post("/{item_id}/convert-async", response_model=ConvertAsyncResponse)
async def convert_usd_to_glb_async(item_id: str, req: ConvertRequest, db: AsyncSession = Depends(get_db)):
    """Queue USD→GLB conversion in Celery."""
    res = await db.execute(select(TwinAssetLibraryItem).where(TwinAssetLibraryItem.id == item_id))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Catalog item not found")
    if not item.usd_path:
        raise HTTPException(status_code=400, detail="This item has no usd_path")

    task = celery_app.send_task(
        "twin_assets.convert_usd_to_glb",
        args=[item_id],
        kwargs={"usd_ext": req.usd_ext, "overwrite": req.overwrite},
    )

    # store last task id in metadata (best-effort)
    try:
        current = json.loads(item.extra_metadata) if item.extra_metadata else {}
    except Exception:
        current = {}
    current["conversion"] = {
        "task_id": task.id,
        "state": "queued",
        "updated_at": datetime.utcnow().isoformat(),
    }
    item.extra_metadata = json.dumps(current)
    item.updated_at = datetime.utcnow()
    await db.commit()

    return ConvertAsyncResponse(task_id=str(task.id), item_id=item_id)


@router.get("/{item_id}/convert-status")
async def get_convert_status(item_id: str, db: AsyncSession = Depends(get_db)):
    """Get Celery status for the latest conversion task (if available)."""
    res = await db.execute(select(TwinAssetLibraryItem).where(TwinAssetLibraryItem.id == item_id))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Catalog item not found")

    task_id = None
    try:
        meta = json.loads(item.extra_metadata) if item.extra_metadata else {}
        task_id = meta.get("conversion", {}).get("task_id")
    except Exception:
        task_id = None

    if not task_id:
        return {"status": "no_task", "glb_object": item.glb_object}

    r = AsyncResult(task_id, app=celery_app)
    payload = {"task_id": task_id, "state": r.state, "glb_object": item.glb_object}
    if isinstance(r.info, dict):
        payload["info"] = r.info
    return payload

