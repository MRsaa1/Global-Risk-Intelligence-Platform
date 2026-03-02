"""
PARS Protocol (Physical Asset Risk Schema) - Layer 5 v1.0.

Export/import API: assets in PARS format with JSON Schema validation.
Schema versioning, backward compatibility, and interoperability.
"""
import json
import logging
from pathlib import Path
from typing import Any, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.asset import Asset

router = APIRouter()
logger = logging.getLogger(__name__)

SCHEMA_PATH = Path(__file__).resolve().parents[6] / "data" / "schemas" / "pars-asset-v1.json"
PARS_SCHEMA_VERSION = "1.0"

_SCHEMA_CACHE: dict | None = None


def _load_schema() -> dict:
    global _SCHEMA_CACHE
    if _SCHEMA_CACHE is None and SCHEMA_PATH.exists():
        _SCHEMA_CACHE = json.loads(SCHEMA_PATH.read_text())
    return _SCHEMA_CACHE or {}


def _validate_pars_document(doc: dict) -> list[str]:
    """Validate a PARS document against the schema. Returns list of errors."""
    errors: list[str] = []
    if not isinstance(doc, dict):
        return ["Document must be a JSON object"]
    if "asset" not in doc:
        errors.append("Missing required field: 'asset'")
        return errors
    asset = doc["asset"]
    if not isinstance(asset, dict):
        errors.append("'asset' must be an object")
        return errors
    if "identity" not in asset:
        errors.append("Missing required field: 'asset.identity'")
    else:
        identity = asset["identity"]
        if not isinstance(identity, dict):
            errors.append("'asset.identity' must be an object")
        elif "pars_id" not in identity:
            errors.append("Missing required field: 'asset.identity.pars_id'")
        elif not isinstance(identity["pars_id"], str) or not identity["pars_id"].startswith("PARS-"):
            errors.append("'pars_id' must be a string starting with 'PARS-'")
    try:
        import jsonschema
        schema = _load_schema()
        if schema:
            jsonschema.validate(doc, schema)
    except ImportError:
        pass  # jsonschema not installed -- skip deep validation
    except Exception as e:
        errors.append(f"Schema validation: {e}")
    return errors


def _asset_to_pars(asset: Asset) -> dict[str, Any]:
    """Map DB Asset to PARS Asset JSON (v1)."""
    identity: dict[str, Any] = {
        "pars_id": asset.pars_id or f"PARS-EU-{getattr(asset, 'country_code', 'XX')}-XXX-{asset.id[:8].upper()}",
    }
    if asset.id:
        identity["external_ids"] = {"platform_id": asset.id}
    physical: dict[str, Any] = {}
    if asset.latitude is not None and asset.longitude is not None:
        physical["geometry"] = {
            "type": "Point",
            "coordinates": [asset.longitude, asset.latitude],
        }
    if asset.year_built is not None or asset.construction_type:
        physical["condition"] = {
            "year_built": asset.year_built,
            "year_renovated": getattr(asset, "year_renovated", None),
            "construction_type": getattr(asset, "construction_type", None),
        }
    exposures: dict[str, Any] = {}
    if asset.climate_risk_score is not None or asset.physical_risk_score is not None or asset.network_risk_score is not None:
        exposures["climate"] = {}
        if asset.climate_risk_score is not None:
            exposures["climate"]["composite_score_0_100"] = asset.climate_risk_score
        exposures["risk_scores"] = {
            "physical_risk_0_100": getattr(asset, "physical_risk_score", None),
            "network_risk_0_100": getattr(asset, "network_risk_score", None),
        }
    financial: dict[str, Any] = {}
    if asset.current_valuation is not None:
        financial["valuation"] = {
            "value": asset.current_valuation,
            "currency": getattr(asset, "valuation_currency", "EUR") or "EUR",
            "as_of": getattr(asset, "valuation_date", None).isoformat() if getattr(asset, "valuation_date", None) else None,
        }
    provenance: dict[str, Any] = {
        "data_sources": [],
        "verifications": [],
    }
    return {
        "asset": {
            "identity": identity,
            "name": asset.name,
            "description": getattr(asset, "description", None),
            "asset_type": getattr(asset, "asset_type", None),
            "status": getattr(asset, "status", None),
            "address": getattr(asset, "address", None),
            "country_code": getattr(asset, "country_code", None),
            "region": getattr(asset, "region", None),
            "city": getattr(asset, "city", None),
            "postal_code": getattr(asset, "postal_code", None),
            "physical": physical if physical else None,
            "exposures": exposures if exposures else None,
            "financial": financial if financial else None,
            "provenance": provenance,
        }
    }


@router.get(
    "/export/assets",
    summary="Export assets in PARS format",
    description="Returns all assets (or filtered) as PARS v1 Asset documents. Layer 5 Protocol.",
)
async def export_assets(
    limit: int = Query(10_000, ge=1, le=100_000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    result = await db.execute(
        select(Asset).order_by(Asset.pars_id).offset(offset).limit(limit)
    )
    assets = result.scalars().all()
    items = [_asset_to_pars(a) for a in assets]
    return {
        "pars_version": PARS_SCHEMA_VERSION,
        "schema_ref": "https://pars.standard.org/v1/asset.json",
        "count": len(items),
        "offset": offset,
        "limit": limit,
        "items": items,
    }


@router.get(
    "/schema",
    summary="PARS Asset schema (JSON Schema)",
    description="Returns the PARS v1 Asset JSON Schema. Versioned.",
)
async def get_pars_schema() -> JSONResponse:
    if SCHEMA_PATH.exists():
        import json
        body = json.loads(SCHEMA_PATH.read_text())
        body["x_pars_version"] = PARS_SCHEMA_VERSION
        return JSONResponse(content=body)
    # Inline minimal schema if file missing
    return JSONResponse(
        content={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "$id": "https://pars.standard.org/v1/asset.json",
            "x_pars_version": PARS_SCHEMA_VERSION,
            "title": "PARS Asset",
            "description": "Physical Asset Risk Schema - Layer 5 Protocol.",
            "type": "object",
            "required": ["asset"],
            "properties": {
                "asset": {
                    "type": "object",
                    "required": ["identity"],
                    "properties": {
                        "identity": {
                            "type": "object",
                            "properties": {
                                "pars_id": {
                                    "type": "string",
                                    "pattern": "^PARS-[A-Z]{2}-[A-Z]{2}-[A-Z0-9]+$",
                                },
                            },
                        },
                    },
                },
            },
        }
    )


@router.get(
    "/export/assets/{asset_id}",
    summary="Export single asset in PARS format",
)
async def export_single_asset(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    result = await db.execute(
        select(Asset).where((Asset.id == asset_id) | (Asset.pars_id == asset_id))
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    doc = _asset_to_pars(asset)
    doc["pars_version"] = PARS_SCHEMA_VERSION
    return doc


@router.post(
    "/validate",
    summary="Validate a PARS document",
    description="Validate a PARS document against the v1 schema without importing.",
)
async def validate_pars(body: dict) -> dict[str, Any]:
    errors = _validate_pars_document(body)
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "pars_version": PARS_SCHEMA_VERSION,
    }


class PARSImportRequest(BaseModel):
    """Import PARS-formatted assets."""
    items: List[dict] = Field(..., min_length=1, max_length=10000, description="Array of PARS asset documents")
    skip_validation: bool = Field(False, description="Skip schema validation")
    upsert: bool = Field(False, description="Update existing assets by pars_id")


@router.post(
    "/import",
    summary="Import assets from PARS format",
    description="Ingest PARS-formatted assets into the platform. Validates against schema unless skip_validation=true.",
)
async def import_assets(
    body: PARSImportRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    imported = 0
    updated = 0
    skipped = 0
    errors: list[dict[str, Any]] = []

    for idx, item in enumerate(body.items):
        # Validate
        if not body.skip_validation:
            doc_errors = _validate_pars_document(item)
            if doc_errors:
                errors.append({"index": idx, "errors": doc_errors})
                skipped += 1
                continue

        asset_data = item.get("asset", {})
        identity = asset_data.get("identity", {})
        pars_id = identity.get("pars_id")
        if not pars_id:
            errors.append({"index": idx, "errors": ["Missing pars_id"]})
            skipped += 1
            continue

        # Check existing
        existing = await db.execute(select(Asset).where(Asset.pars_id == pars_id))
        existing_asset = existing.scalar_one_or_none()

        if existing_asset and not body.upsert:
            skipped += 1
            continue

        # Extract fields
        physical = asset_data.get("physical", {})
        geometry = physical.get("geometry", {})
        condition = physical.get("condition", {})
        location = physical.get("location", {})
        financial = asset_data.get("financial", {})
        valuation = financial.get("valuation", {})
        exposures = asset_data.get("exposures", {})
        climate = exposures.get("climate", {})
        risk_scores = exposures.get("risk_scores", {})

        coords = geometry.get("coordinates", [])
        lng = coords[0] if len(coords) > 0 else None
        lat = coords[1] if len(coords) > 1 else None

        if existing_asset and body.upsert:
            # Update existing
            if asset_data.get("name"):
                existing_asset.name = asset_data["name"][:255]
            if lat is not None:
                existing_asset.latitude = lat
            if lng is not None:
                existing_asset.longitude = lng
            if valuation.get("market_value_usd"):
                existing_asset.current_valuation = valuation["market_value_usd"]
            if climate.get("composite_score_0_100") is not None:
                existing_asset.climate_risk_score = climate["composite_score_0_100"]
            updated += 1
        else:
            # Create new
            new_asset = Asset(
                id=str(uuid4()),
                pars_id=pars_id,
                name=(asset_data.get("name") or identity.get("pars_id"))[:255],
                asset_type=identity.get("asset_type", "other"),
                latitude=lat,
                longitude=lng,
                country_code=location.get("country_code"),
                city=location.get("city") or asset_data.get("city"),
                address=location.get("address") or asset_data.get("address"),
                year_built=condition.get("year_built"),
                construction_type=condition.get("construction_type"),
                current_valuation=valuation.get("market_value_usd"),
                climate_risk_score=climate.get("composite_score_0_100"),
                physical_risk_score=risk_scores.get("physical_risk_0_100"),
                network_risk_score=risk_scores.get("network_risk_0_100"),
            )
            db.add(new_asset)
            imported += 1

    await db.commit()

    return {
        "status": "completed",
        "pars_version": PARS_SCHEMA_VERSION,
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "errors": errors[:50],
        "total_items": len(body.items),
    }


@router.get(
    "/status",
    summary="PARS protocol status",
)
async def pars_status(
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    from sqlalchemy import func
    r = await db.execute(select(func.count(Asset.id)))
    total = r.scalar() or 0
    schema = _load_schema()
    return {
        "protocol": "PARS",
        "version": PARS_SCHEMA_VERSION,
        "schema_title": "Physical Asset Risk Schema",
        "schema_available": bool(schema),
        "export_available": True,
        "import_available": True,
        "validation_available": True,
        "total_assets_exportable": total,
        "features": ["export", "import", "validate", "schema", "single_asset_export"],
    }
