"""Celery tasks for twin asset library conversion."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime
from io import BytesIO

from celery import states
from celery.utils.log import get_task_logger
from minio.error import S3Error
from sqlalchemy import select

from src.core.celery_app import celery_app
from src.core.config import settings
from src.core.database import AsyncSessionLocal
from src.core.storage import storage
from src.models.twin_asset_library import TwinAssetLibraryItem
from src.services.glb_metadata import glb_triangle_count
from src.services.glb_optimize import optimize_glb_bytes
from src.services.nucleus_fetch import NucleusFetchError, fetch_usd_bytes
from src.services.usd_to_glb import UsdToGlbUnavailable, convert_usd_bytes_to_glb

logger = get_task_logger(__name__)


def _update_metadata(item: TwinAssetLibraryItem, patch: dict) -> None:
    try:
        existing = json.loads(item.extra_metadata) if item.extra_metadata else {}
    except Exception:
        existing = {}
    # shallow merge
    for k, v in patch.items():
        existing[k] = v
    item.extra_metadata = json.dumps(existing)


async def _convert(item_id: str, task_id: str, usd_ext: str = ".usd", overwrite: bool = False) -> dict:
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(TwinAssetLibraryItem).where(TwinAssetLibraryItem.id == item_id))
        item = res.scalar_one_or_none()
        if not item:
            raise RuntimeError("Catalog item not found")
        if not item.usd_path:
            raise RuntimeError("This item has no usd_path")

        if item.glb_object and not overwrite:
            _update_metadata(
                item,
                {
                    "conversion": {
                        "task_id": task_id,
                        "state": "skipped",
                        "updated_at": datetime.utcnow().isoformat(),
                        "reason": "glb_exists",
                    }
                },
            )
            item.updated_at = datetime.utcnow()
            await db.commit()
            return {"status": "skipped", "glb_object": item.glb_object}

        # Fetch USD from Nucleus/storage/fs
        usd_bytes = fetch_usd_bytes(item.usd_path)

        # Convert USD→GLB
        glb_bytes = convert_usd_bytes_to_glb(usd_bytes, usd_ext=usd_ext)

        if not storage.is_available:
            raise RuntimeError("Object storage unavailable")

        # Optional: generate a simple thumbnail + bounds metadata (best-effort)
        bounds = None
        thumb_path = None
        try:
            # Bounds from GLB via trimesh (optional dependency group `bim`)
            import tempfile
            from pathlib import Path
            import trimesh  # type: ignore

            with tempfile.TemporaryDirectory() as td:
                p = Path(td) / "model.glb"
                p.write_bytes(glb_bytes)
                scene = trimesh.load(str(p), force="scene")
                if hasattr(scene, "bounds") and scene.bounds is not None:
                    b = scene.bounds.tolist()
                    bounds = {"min": b[0], "max": b[1]}
        except Exception:
            bounds = None

        try:
            # Placeholder thumbnail via Pillow (optional dependency group `usd`)
            from PIL import Image, ImageDraw, ImageFont  # type: ignore

            img = Image.new("RGB", (768, 512), color=(7, 12, 20))
            d = ImageDraw.Draw(img)
            title = item.name[:64]
            subtitle = f"{item.domain}/{item.kind}"
            d.text((24, 28), title, fill=(230, 236, 245))
            d.text((24, 70), subtitle, fill=(130, 145, 165))
            if item.usd_path:
                d.text((24, 110), f"USD: {item.usd_path[:80]}", fill=(90, 105, 125))
            if bounds:
                d.text((24, 150), f"Bounds: {bounds['min']} → {bounds['max']}", fill=(90, 105, 125))
            bio = BytesIO()
            img.save(bio, format="PNG")
            bio.seek(0)
            thumb_object = f"twins/library/{item.id}/thumbnail.png"
            thumb_path = storage.upload_file(
                settings.minio_bucket_assets,
                thumb_object,
                bio,
                content_type="image/png",
                metadata={"twin_asset_library_id": item.id},
            )
        except Exception:
            thumb_path = None

        object_name = f"twins/library/{item.id}/model.glb"
        try:
            glb_path = storage.upload_file(
                settings.minio_bucket_assets,
                object_name,
                BytesIO(glb_bytes),
                content_type="model/gltf-binary",
                metadata={"twin_asset_library_id": item.id},
            )
        except S3Error as e:
            raise RuntimeError(f"MinIO upload failed: {e}")

        item.glb_object = glb_path
        if thumb_path:
            item.thumbnail_object = thumb_path
        item.updated_at = datetime.utcnow()
        _update_metadata(
            item,
            {
                "conversion": {
                    "task_id": task_id,
                    "state": "converted",
                    "updated_at": datetime.utcnow().isoformat(),
                    "bytes": len(glb_bytes),
                }
            },
        )
        if bounds:
            _update_metadata(item, {"bounds": bounds})
        await db.commit()
        return {"status": "converted", "glb_object": glb_path, "bytes": len(glb_bytes)}


def _split_bucket_path(p: str) -> tuple[str, str]:
    parts = p.split("/", 1)
    if len(parts) != 2:
        raise ValueError("Invalid storage path; expected 'bucket/object'")
    return parts[0], parts[1]


async def _optimize_glb(item_id: str) -> dict:
    """Download GLB from MinIO, run gltf-transform optimize, re-upload, update metadata."""
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(TwinAssetLibraryItem).where(TwinAssetLibraryItem.id == item_id))
        item = res.scalar_one_or_none()
        if not item or not item.glb_object:
            raise RuntimeError("Catalog item or GLB not found")
        path = str(item.glb_object)
        if path.startswith(("http://", "https://")):
            raise RuntimeError("Cannot optimize: item uses external URL")
        if not storage.is_available:
            raise RuntimeError("Object storage unavailable")
        bucket, object_name = _split_bucket_path(path)
        try:
            glb_bytes = storage.download_file(bucket, object_name)
        except S3Error:
            raise RuntimeError("GLB object not found in storage")
        optimized = optimize_glb_bytes(glb_bytes)
        if optimized is None:
            raise RuntimeError("Optimization unavailable (npx and @gltf-transform/cli required)")
        storage.upload_file(
            bucket,
            object_name,
            BytesIO(optimized),
            content_type="model/gltf-binary",
            metadata={"twin_asset_library_id": item.id},
        )
        file_size = len(optimized)
        poly_count = glb_triangle_count(optimized)
        _update_metadata(
            item,
            {"file_size_bytes": file_size, **({"poly_count": poly_count} if poly_count is not None else {})},
        )
        item.updated_at = datetime.utcnow()
        await db.commit()
        return {"status": "optimized", "glb_object": path, "bytes": file_size}


@celery_app.task(bind=True, name="twin_assets.convert_usd_to_glb")
def convert_usd_to_glb_task(self, item_id: str, usd_ext: str = ".usd", overwrite: bool = False):
    """Convert a catalog item's USD master into a GLB derivative."""
    task_id = getattr(self.request, "id", None) or ""
    logger.info("convert_usd_to_glb_task started item_id=%s task_id=%s", item_id, task_id)

    try:
        result = asyncio.run(_convert(item_id=item_id, task_id=task_id, usd_ext=usd_ext, overwrite=overwrite))
        return result
    except (UsdToGlbUnavailable, NucleusFetchError) as e:
        # mark as retryable infra error
        self.update_state(state=states.FAILURE, meta={"error": str(e)})
        raise
    except Exception as e:
        self.update_state(state=states.FAILURE, meta={"error": str(e)})
        raise


@celery_app.task(bind=True, name="twin_assets.optimize_glb")
def optimize_glb_task(self, item_id: str):
    """Re-optimize a catalog item's GLB with gltf-transform (background)."""
    logger.info("optimize_glb_task started item_id=%s", item_id)
    try:
        return asyncio.run(_optimize_glb(item_id))
    except Exception as e:
        self.update_state(state=states.FAILURE, meta={"error": str(e)})
        raise

