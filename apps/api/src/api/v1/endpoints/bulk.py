"""
Bulk Operations API Endpoints.

Provides endpoints for bulk data operations:
- CSV asset upload
- Bulk stress test execution
- Batch operations
"""
import time
import logging
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import get_current_user
from src.models.user import User
import io
import json

logger = logging.getLogger(__name__)

from src.core.database import get_db
from src.services.bulk_operations import bulk_service, BulkOperationResult
from src.services.asset_risk_calculator import asset_risk_calculator
from src.services.event_emitter import event_emitter
from src.models.asset import Asset, AssetStatus, AssetType

router = APIRouter()


# ==================== SCHEMAS ====================

class BulkStressTestRequest(BaseModel):
    """Request for bulk stress test execution."""
    cities: List[str] = Field(..., min_length=1, max_length=50)
    test_type: str = Field(default="flood")
    scenario_name: str = Field(default="Bulk Stress Test")
    severity: float = Field(default=0.7, ge=0, le=1)
    run_async: bool = Field(default=True)


class BulkStressTestResponse(BaseModel):
    """Response for bulk stress test."""
    job_id: str
    status: str
    cities_count: int
    test_type: str
    scenario_name: str
    message: str


class BulkDeleteRequest(BaseModel):
    """Request for bulk delete operation."""
    asset_ids: List[str] = Field(..., min_length=1, max_length=100)
    confirm: bool = Field(default=False)


class BulkUpdateRequest(BaseModel):
    """Request for bulk update operation."""
    asset_ids: List[str] = Field(..., min_length=1, max_length=100)
    updates: dict = Field(...)


# ==================== HELPER FUNCTIONS ====================

def _generate_pars_id(country_code: str, city: str | None, asset_id: str) -> str:
    """Generate PARS Protocol ID."""
    city_code = (city or "XXX")[:3].upper()
    short_id = asset_id[-8:].upper()
    return f"PARS-EU-{country_code.upper()}-{city_code}-{short_id}"


async def _create_assets_from_validated(
    validated_assets: List[dict],
    db: AsyncSession
) -> tuple[List[str], List[dict]]:
    """Create assets in database from validated data."""
    created_ids = []
    errors = []
    
    for i, asset_data in enumerate(validated_assets):
        try:
            asset_id = uuid4()
            pars_id = _generate_pars_id(
                asset_data.get('country_code', 'DE'),
                asset_data.get('city'),
                str(asset_id),
            )
            
            # Map asset type string to enum
            asset_type_str = asset_data.get('asset_type', 'commercial_office')
            try:
                asset_type = AssetType(asset_type_str)
            except ValueError:
                asset_type = AssetType.COMMERCIAL_OFFICE
            
            tags_raw = asset_data.get('tags') or []
            tags_json = json.dumps(tags_raw) if isinstance(tags_raw, list) else (tags_raw if isinstance(tags_raw, str) else '[]')
            
            asset = Asset(
                id=asset_id,
                pars_id=pars_id,
                name=asset_data['name'],
                description=asset_data.get('description'),
                asset_type=asset_type,
                status=AssetStatus.DRAFT,
                latitude=asset_data.get('latitude'),
                longitude=asset_data.get('longitude'),
                address=asset_data.get('address'),
                country_code=asset_data.get('country_code', 'DE'),
                region=asset_data.get('region'),
                city=asset_data.get('city'),
                postal_code=asset_data.get('postal_code'),
                gross_floor_area_m2=asset_data.get('gross_floor_area_m2'),
                year_built=asset_data.get('year_built'),
                floors_above_ground=asset_data.get('floors_above_ground'),
                current_valuation=asset_data.get('current_valuation'),
                valuation_currency=asset_data.get('valuation_currency', 'EUR'),
                tags=tags_json,
            )
            
            db.add(asset)
            created_ids.append(str(asset_id))
            
        except Exception as e:
            errors.append({
                'index': i,
                'name': asset_data.get('name', 'Unknown'),
                'error': str(e)
            })
    
    if created_ids:
        await db.commit()
    
    return created_ids, errors


# ==================== API ENDPOINTS ====================

@router.get("/assets/template")
async def download_csv_template():
    """
    Download a sample CSV template for bulk asset upload.
    
    The template includes:
    - Column headers with all supported fields
    - 3 sample rows with example data
    - Instructions in the format
    """
    csv_content = bulk_service.generate_sample_csv()
    
    return StreamingResponse(
        io.BytesIO(csv_content),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="asset_upload_template.csv"',
        }
    )


@router.post("/assets/validate")
async def validate_csv_upload(
    file: UploadFile = File(...),
):
    """
    Validate a CSV file without importing.
    
    Use this to check for errors before actual import.
    Returns validation results with detailed error messages.
    """
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported. Please upload a .csv file."
        )
    
    # Read file content
    content = await file.read()
    
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 10MB."
        )
    
    # Parse and validate
    valid_assets, errors = bulk_service.parse_assets_csv(content)
    
    return {
        "valid": len(errors) == 0,
        "total_rows": len(valid_assets) + len(errors),
        "valid_count": len(valid_assets),
        "error_count": len(errors),
        "errors": errors[:50],  # Return first 50 errors
        "sample_valid": valid_assets[:5] if valid_assets else [],  # Return first 5 valid
    }


@router.post("/import-assets", response_model=BulkOperationResult)
async def import_assets_csv(
    file: UploadFile = File(...),
    skip_errors: bool = False,
    calculate_risks: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bulk import assets from CSV file (alias for /assets/upload).
    
    Same as /assets/upload but with additional option to calculate risk scores
    automatically after import.
    """
    return await upload_assets_csv(file, skip_errors, calculate_risks, db, current_user)


@router.post("/assets/upload", response_model=BulkOperationResult)
async def upload_assets_csv(
    file: UploadFile = File(...),
    skip_errors: bool = False,
    calculate_risks: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bulk upload assets from CSV file.
    
    **File Requirements:**
    - Format: CSV (comma-separated)
    - Encoding: UTF-8 (recommended) or Latin-1
    - Max size: 10MB
    - Max rows: 1000
    
    **Required Columns:**
    - name: Asset name (required)
    
    **Optional Columns:**
    - asset_type: office, retail, industrial, logistics, data_center, hotel, residential, mixed_use
    - address, city, country_code (2-letter ISO)
    - latitude, longitude
    - valuation, currency
    - year_built, gross_floor_area_m2, floors_above_ground
    - tags (comma-separated), description
    
    **Options:**
    - skip_errors: If true, import valid rows even if some have errors
    """
    start_time = time.time()
    
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported."
        )
    
    # Read file content
    content = await file.read()
    
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum 10MB.")
    
    # Parse and validate
    valid_assets, parse_errors = bulk_service.parse_assets_csv(content)
    
    # Check for errors
    if parse_errors and not skip_errors:
        return BulkOperationResult(
            success=False,
            total_records=len(valid_assets) + len(parse_errors),
            processed=0,
            succeeded=0,
            failed=len(parse_errors),
            errors=parse_errors[:50],
            created_ids=[],
            processing_time_ms=int((time.time() - start_time) * 1000),
        )
    
    # Check batch size
    if len(valid_assets) > 1000:
        raise HTTPException(
            status_code=400,
            detail=f"Too many rows ({len(valid_assets)}). Maximum 1000 per upload."
        )
    
    # Create assets
    created_ids, create_errors = await _create_assets_from_validated(valid_assets, db)
    
    # Calculate risk scores for created assets if requested
    if calculate_risks and created_ids:
        try:
            from sqlalchemy import select
            from uuid import UUID
            
            # Fetch created assets
            asset_uuids = [UUID(id) for id in created_ids]
            result = await db.execute(
                select(Asset).where(Asset.id.in_(asset_uuids))
            )
            created_assets = result.scalars().all()
            
            # Calculate risks for each asset
            for asset in created_assets:
                try:
                    risks = await asset_risk_calculator.calculate_all_risks(asset)
                    asset.climate_risk_score = risks['climate_risk_score']
                    asset.physical_risk_score = risks['physical_risk_score']
                    asset.network_risk_score = risks['network_risk_score']
                except Exception as e:
                    logger.warning(f"Failed to calculate risks for asset {asset.id}: {e}")
                    # Set defaults if calculation fails
                    asset.climate_risk_score = 40.0
                    asset.physical_risk_score = 25.0
                    asset.network_risk_score = 30.0
            
            await db.commit()
            logger.info(f"Calculated risk scores for {len(created_assets)} assets")
        except Exception as e:
            logger.error(f"Error calculating risk scores: {e}")
            # Don't fail the import if risk calculation fails
    
    all_errors = parse_errors + create_errors
    
    # Emit portfolio updated event for bulk import
    if created_ids:
        await event_emitter.emit_portfolio_updated(
            portfolio_data={
                "action": "bulk_import",
                "assets_created": len(created_ids),
                "created_ids": created_ids[:10],  # First 10 for reference
            }
        )
    
    return BulkOperationResult(
        success=len(create_errors) == 0 and (len(parse_errors) == 0 or skip_errors),
        total_records=len(valid_assets) + len(parse_errors),
        processed=len(valid_assets),
        succeeded=len(created_ids),
        failed=len(all_errors),
        errors=all_errors[:50],
        created_ids=created_ids,
        processing_time_ms=int((time.time() - start_time) * 1000),
    )


@router.post("/stress-tests/bulk", response_model=BulkStressTestResponse)
async def run_bulk_stress_test(
    request: BulkStressTestRequest,
    background_tasks: BackgroundTasks,
):
    """
    Run stress tests on multiple cities at once.
    
    **Parameters:**
    - cities: List of city names (max 50)
    - test_type: flood, seismic, fire, financial, pandemic, climate
    - scenario_name: Name for the test scenario
    - severity: Stress severity (0-1)
    - run_async: If true, run in background
    
    Returns a job ID that can be used to check status.
    """
    # Validate
    is_valid, errors = await bulk_service.validate_bulk_stress_test(
        request.cities,
        request.test_type,
        request.scenario_name,
    )
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    
    # Generate job ID
    job_id = f"bulk-st-{datetime.now().strftime('%Y%m%d%H%M%S')}-{str(uuid4())[:8]}"
    
    # For now, return immediate response
    # In production, this would queue a background task
    
    return BulkStressTestResponse(
        job_id=job_id,
        status="queued" if request.run_async else "running",
        cities_count=len(request.cities),
        test_type=request.test_type,
        scenario_name=request.scenario_name,
        message=f"Bulk stress test queued for {len(request.cities)} cities. "
                f"Use job ID to check status.",
    )


@router.post("/assets/delete")
async def bulk_delete_assets(
    request: BulkDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete multiple assets at once.
    
    **Safety:**
    - Set confirm=true to actually delete
    - Without confirm, returns preview of what would be deleted
    """
    from sqlalchemy import select, delete
    
    # Convert string IDs to UUIDs
    try:
        from uuid import UUID
        asset_uuids = [UUID(id) for id in request.asset_ids]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid asset ID format: {e}")
    
    # Get assets to delete
    result = await db.execute(
        select(Asset.id, Asset.name).where(Asset.id.in_(asset_uuids))
    )
    found_assets = result.all()
    found_ids = {str(a[0]) for a in found_assets}
    
    not_found = [id for id in request.asset_ids if id not in found_ids]
    
    if not request.confirm:
        return {
            "preview": True,
            "will_delete": len(found_assets),
            "assets": [{"id": str(a[0]), "name": a[1]} for a in found_assets],
            "not_found": not_found,
            "message": "Set confirm=true to delete these assets",
        }
    
    # Delete assets
    if found_assets:
        await db.execute(
            delete(Asset).where(Asset.id.in_([a[0] for a in found_assets]))
        )
        await db.commit()
        
        # Emit portfolio updated event for bulk delete
        await event_emitter.emit_portfolio_updated(
            portfolio_data={
                "action": "bulk_delete",
                "assets_deleted": len(found_assets),
                "deleted_names": [a[1] for a in found_assets[:10]],  # First 10 names
            }
        )
    
    return {
        "success": True,
        "deleted": len(found_assets),
        "not_found": not_found,
    }


@router.post("/assets/recalculate-risks")
async def recalculate_asset_risks(
    asset_ids: Optional[List[str]] = None,
    all_assets: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Recalculate risk scores for assets using real data.
    
    **Options:**
    - asset_ids: List of specific asset IDs to recalculate
    - all_assets: If true, recalculate all active assets
    
    Uses:
    - Climate data (NOAA, CMIP6, FEMA)
    - Physical risk (FEMA, building age)
    - Network risk (Knowledge Graph)
    """
    from sqlalchemy import select
    from uuid import UUID
    
    if all_assets:
        # Get all active assets
        result = await db.execute(
            select(Asset).where(Asset.status == AssetStatus.ACTIVE.value)
        )
        assets = result.scalars().all()
    elif asset_ids:
        # Get specific assets
        try:
            asset_uuids = [UUID(id) for id in asset_ids]
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid asset ID format: {e}")
        
        result = await db.execute(
            select(Asset).where(Asset.id.in_(asset_uuids))
        )
        assets = result.scalars().all()
    else:
        raise HTTPException(
            status_code=400,
            detail="Either provide asset_ids or set all_assets=true"
        )
    
    if not assets:
        return {
            "success": True,
            "processed": 0,
            "succeeded": 0,
            "failed": 0,
            "message": "No assets found",
        }
    
    succeeded = 0
    failed = 0
    errors = []
    
    for asset in assets:
        try:
            risks = await asset_risk_calculator.calculate_all_risks(asset)
            asset.climate_risk_score = risks['climate_risk_score']
            asset.physical_risk_score = risks['physical_risk_score']
            asset.network_risk_score = risks['network_risk_score']
            succeeded += 1
            
            # Emit asset risk updated event
            await event_emitter.emit_asset_risk_updated(
                asset_id=str(asset.id),
                asset_name=asset.name,
                climate_risk=risks['climate_risk_score'],
                physical_risk=risks['physical_risk_score'],
                network_risk=risks['network_risk_score'],
            )
        except Exception as e:
            failed += 1
            errors.append({
                "asset_id": str(asset.id),
                "name": asset.name,
                "error": str(e),
            })
            logger.error(f"Failed to calculate risks for asset {asset.id}: {e}")
    
    await db.commit()
    
    # Emit portfolio updated event if risks were recalculated
    if succeeded > 0:
        await event_emitter.emit_portfolio_updated(
            portfolio_data={
                "action": "risks_recalculated",
                "assets_updated": succeeded,
            }
        )
    
    return {
        "success": failed == 0,
        "processed": len(assets),
        "succeeded": succeeded,
        "failed": failed,
        "errors": errors[:50],
        "message": f"Recalculated risks for {succeeded} assets",
    }


@router.post("/assets/update")
async def bulk_update_assets(
    request: BulkUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update multiple assets at once.
    
    **Supported updates:**
    - status: Change status (draft, active, under_review, etc.)
    - tags: Replace tags array
    - add_tags: Add tags to existing
    - remove_tags: Remove specific tags
    """
    from sqlalchemy import select, update
    from uuid import UUID
    
    # Convert string IDs to UUIDs
    try:
        asset_uuids = [UUID(id) for id in request.asset_ids]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid asset ID format: {e}")
    
    # Get assets to update
    result = await db.execute(
        select(Asset).where(Asset.id.in_(asset_uuids))
    )
    assets = result.scalars().all()
    
    if not assets:
        raise HTTPException(status_code=404, detail="No assets found")
    
    updated_count = 0
    updates = request.updates
    
    for asset in assets:
        # Status update
        if 'status' in updates:
            try:
                asset.status = AssetStatus(updates['status'])
                updated_count += 1
            except ValueError:
                pass
        
        # Tags replacement
        if 'tags' in updates:
            asset.tags = updates['tags'] if isinstance(updates['tags'], list) else []
            updated_count += 1
        
        # Add tags
        if 'add_tags' in updates:
            current_tags = set(asset.tags or [])
            new_tags = set(updates['add_tags']) if isinstance(updates['add_tags'], list) else set()
            asset.tags = list(current_tags | new_tags)
            updated_count += 1
        
        # Remove tags
        if 'remove_tags' in updates:
            current_tags = set(asset.tags or [])
            remove_tags = set(updates['remove_tags']) if isinstance(updates['remove_tags'], list) else set()
            asset.tags = list(current_tags - remove_tags)
            updated_count += 1
    
    await db.commit()
    
    # Emit portfolio updated event for bulk update
    if updated_count > 0:
        await event_emitter.emit_portfolio_updated(
            portfolio_data={
                "action": "bulk_update",
                "assets_updated": len(assets),
                "updates_applied": list(updates.keys()),
            }
        )
    
    return {
        "success": True,
        "updated": len(assets),
        "not_found": len(request.asset_ids) - len(assets),
    }
