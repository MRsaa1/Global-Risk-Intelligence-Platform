"""
BIM File Processing API Endpoints.

Provides endpoints for:
- BIM file upload and processing
- 3D model retrieval
- Element queries
- Geometry export
"""
import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import io

from src.core.database import get_db
from src.core.config import settings
from src.models.asset import Asset
from src.services.bim_processor import bim_processor, BIMProcessingResult, BIMMetadata

router = APIRouter()


# ==================== SCHEMAS ====================

class BIMUploadResponse(BaseModel):
    """Response after BIM file upload."""
    success: bool
    asset_id: str
    file_name: str
    file_size: int
    processing_status: str
    metadata: Optional[dict] = None
    errors: List[str] = []
    warnings: List[str] = []
    processing_time_ms: int


class BIMMetadataResponse(BaseModel):
    """BIM file metadata."""
    file_name: str
    file_size: int
    file_hash: str
    ifc_schema: str
    application: Optional[str]
    author: Optional[str]
    organization: Optional[str]
    creation_date: Optional[datetime]
    
    # Statistics
    element_count: int
    floor_count: int
    space_count: int
    wall_count: int
    door_count: int
    window_count: int
    
    # Building info
    building_name: Optional[str]
    site_name: Optional[str]
    project_name: Optional[str]
    
    # Geometry
    gross_floor_area: Optional[float]


class BIMElementResponse(BaseModel):
    """Single BIM element."""
    id: str
    ifc_type: str
    name: Optional[str]
    description: Optional[str]
    properties: dict
    level: Optional[str]


class BIMSpatialHierarchyResponse(BaseModel):
    """Spatial hierarchy of BIM model."""
    project: Optional[str]
    sites: List[dict]
    buildings: List[dict]
    floors: List[dict]


class BIMProcessingStatus(BaseModel):
    """Status of BIM processing job."""
    asset_id: str
    status: str  # pending, processing, completed, failed
    progress: int  # 0-100
    message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]


# ==================== HELPER FUNCTIONS ====================

async def _save_upload_file(upload_file: UploadFile) -> Path:
    """Save uploaded file to temp directory."""
    # Create temp file with original extension
    suffix = Path(upload_file.filename).suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await upload_file.read()
        tmp.write(content)
        return Path(tmp.name)


def _metadata_to_dict(metadata: BIMMetadata) -> dict:
    """Convert BIMMetadata to dictionary."""
    return {
        "file_name": metadata.file_name,
        "file_size": metadata.file_size,
        "file_hash": metadata.file_hash,
        "ifc_schema": metadata.ifc_schema,
        "application": metadata.application,
        "author": metadata.author,
        "organization": metadata.organization,
        "creation_date": metadata.creation_date.isoformat() if metadata.creation_date else None,
        "element_count": metadata.element_count,
        "floor_count": metadata.floor_count,
        "space_count": metadata.space_count,
        "wall_count": metadata.wall_count,
        "door_count": metadata.door_count,
        "window_count": metadata.window_count,
        "building_name": metadata.building_name,
        "site_name": metadata.site_name,
        "project_name": metadata.project_name,
        "gross_floor_area": metadata.gross_floor_area,
    }


# ==================== API ENDPOINTS ====================

@router.post("/upload/{asset_id}", response_model=BIMUploadResponse)
async def upload_bim_file(
    asset_id: UUID,
    file: UploadFile = File(...),
    extract_geometry: bool = Query(True, description="Extract and convert geometry to glTF"),
    generate_thumbnail: bool = Query(True, description="Generate thumbnail image"),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload and process a BIM file (IFC format) for an asset.
    
    **Supported formats:**
    - .ifc (IFC 2x3, IFC 4, IFC 4.3)
    - .ifczip (compressed IFC)
    
    **Processing includes:**
    - Metadata extraction (schema, author, application)
    - Element counting and categorization
    - Spatial hierarchy extraction
    - Geometry conversion to glTF (if extract_geometry=true)
    - Thumbnail generation (if generate_thumbnail=true)
    
    **File size limit:** 100MB
    """
    # Validate asset exists
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Validate file type
    allowed_extensions = {".ifc", ".ifczip"}
    file_ext = ("." + file.filename.split(".")[-1].lower()) if "." in file.filename else ""
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file_ext}'. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Check file size (100MB limit)
    content = await file.read()
    file_size = len(content)
    if file_size > 100 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 100MB."
        )
    
    # Reset file position
    await file.seek(0)
    
    # Save to temp file
    temp_path = await _save_upload_file(file)
    
    try:
        # Process BIM file
        processing_result = await bim_processor.process_file(
            file_path=temp_path,
            asset_id=asset_id,
            extract_geometry=extract_geometry,
            generate_thumbnail=generate_thumbnail,
        )
        
        # Build response
        response = BIMUploadResponse(
            success=processing_result.success,
            asset_id=str(asset_id),
            file_name=file.filename,
            file_size=file_size,
            processing_status="completed" if processing_result.success else "failed",
            metadata=_metadata_to_dict(processing_result.metadata) if processing_result.metadata else None,
            errors=processing_result.errors,
            warnings=processing_result.warnings,
            processing_time_ms=processing_result.processing_time_ms,
        )
        
        # Update asset with BIM info (in production, store in dedicated table)
        # asset.bim_file_path = str(temp_path)
        # await db.commit()
        
        return response
        
    finally:
        # Cleanup temp file
        try:
            os.unlink(temp_path)
        except Exception:
            pass


@router.get("/{asset_id}/metadata", response_model=BIMMetadataResponse)
async def get_bim_metadata(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Get metadata for an asset's BIM file.
    
    Returns information about:
    - File details (name, size, hash, schema)
    - Author and application info
    - Element counts (floors, spaces, walls, etc.)
    - Building information
    """
    # In production, retrieve from database
    # For now, return mock data
    
    return BIMMetadataResponse(
        file_name="building.ifc",
        file_size=15_000_000,
        file_hash="abc123...",
        ifc_schema="IFC4",
        application="Revit 2024",
        author="Architect Name",
        organization="Architecture Firm",
        creation_date=datetime(2024, 1, 15),
        element_count=5420,
        floor_count=12,
        space_count=180,
        wall_count=850,
        door_count=145,
        window_count=220,
        building_name="Main Office Building",
        site_name="Corporate Campus",
        project_name="Corporate HQ Renovation",
        gross_floor_area=25000.0,
    )


@router.get("/{asset_id}/elements")
async def get_bim_elements(
    asset_id: UUID,
    ifc_type: Optional[str] = Query(None, description="Filter by IFC type (e.g., IfcWall)"),
    floor: Optional[str] = Query(None, description="Filter by floor name"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """
    Get BIM elements for an asset.
    
    **Filters:**
    - ifc_type: Filter by IFC element type (IfcWall, IfcDoor, IfcWindow, etc.)
    - floor: Filter by floor/storey name
    
    Returns paginated list of elements with their properties.
    """
    # Mock response for now
    elements = [
        {
            "id": "element-001",
            "ifc_type": "IfcWall",
            "name": "External Wall - North",
            "description": "Load-bearing external wall",
            "properties": {
                "LoadBearing": True,
                "IsExternal": True,
                "FireRating": "2HR",
                "ThermalTransmittance": 0.25,
            },
            "level": "Level 1",
        },
        {
            "id": "element-002",
            "ifc_type": "IfcWindow",
            "name": "Window-001",
            "description": "Double-glazed window",
            "properties": {
                "OverallHeight": 1.5,
                "OverallWidth": 1.2,
                "GlazingType": "Double",
            },
            "level": "Level 1",
        },
    ]
    
    return {
        "items": elements,
        "total": len(elements),
        "limit": limit,
        "offset": offset,
    }


@router.get("/{asset_id}/hierarchy", response_model=BIMSpatialHierarchyResponse)
async def get_bim_spatial_hierarchy(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the spatial hierarchy of the BIM model.
    
    Returns the structure:
    - Project
      - Sites
        - Buildings
          - Floors/Storeys
    """
    # Mock response
    return BIMSpatialHierarchyResponse(
        project="Corporate HQ Project",
        sites=[
            {"id": "site-001", "name": "Main Campus", "address": "123 Business Ave"},
        ],
        buildings=[
            {"id": "bldg-001", "name": "Main Building", "storeys": 12},
        ],
        floors=[
            {"id": "floor-B1", "name": "Basement", "elevation": -3.0},
            {"id": "floor-00", "name": "Ground Floor", "elevation": 0.0},
            {"id": "floor-01", "name": "Level 1", "elevation": 4.0},
            {"id": "floor-02", "name": "Level 2", "elevation": 8.0},
            {"id": "floor-03", "name": "Level 3", "elevation": 12.0},
        ],
    )


@router.get("/{asset_id}/model.gltf")
async def get_bim_3d_model(
    asset_id: UUID,
    lod: str = Query("medium", description="Level of detail: low, medium, high"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the 3D model in glTF format for visualization.
    
    **LOD (Level of Detail):**
    - low: Simplified geometry for fast loading
    - medium: Standard detail (default)
    - high: Full detail with all elements
    
    Returns a glTF file that can be loaded in Three.js, Cesium, etc.
    """
    # In production, return actual glTF file from storage
    # For now, return 404 indicating no model available
    raise HTTPException(
        status_code=404,
        detail="3D model not available. Upload a BIM file first."
    )


@router.get("/{asset_id}/thumbnail")
async def get_bim_thumbnail(
    asset_id: UUID,
    size: str = Query("medium", description="Size: small (128px), medium (256px), large (512px)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a thumbnail image of the BIM model.
    
    Returns a PNG image for preview purposes.
    """
    # In production, return actual thumbnail from storage
    raise HTTPException(
        status_code=404,
        detail="Thumbnail not available. Upload a BIM file first."
    )


@router.post("/{asset_id}/analyze")
async def analyze_bim_for_risk(
    asset_id: UUID,
    analysis_type: str = Query("structural", description="Type of analysis"),
    db: AsyncSession = Depends(get_db),
):
    """
    Analyze BIM model for risk assessment.
    
    **Analysis types:**
    - structural: Analyze structural elements for seismic/wind vulnerability
    - fire: Analyze fire compartments and escape routes
    - flood: Analyze floor elevations and basement vulnerability
    - energy: Analyze thermal properties and energy efficiency
    
    Returns risk metrics based on BIM data.
    """
    # Mock analysis result
    return {
        "asset_id": str(asset_id),
        "analysis_type": analysis_type,
        "status": "completed",
        "results": {
            "structural_score": 72,
            "vulnerability_areas": [
                {"location": "Level 1 - North Wing", "issue": "Large span without intermediate support"},
                {"location": "Basement", "issue": "Below water table level"},
            ],
            "recommendations": [
                "Add structural reinforcement to north wing columns",
                "Install sump pumps in basement",
            ],
        },
        "analyzed_elements": 850,
        "processing_time_ms": 2500,
    }


@router.get("/formats")
async def get_supported_formats():
    """
    Get list of supported BIM file formats and their capabilities.
    """
    return {
        "formats": [
            {
                "extension": ".ifc",
                "name": "Industry Foundation Classes",
                "versions": ["IFC 2x3", "IFC 4", "IFC 4.3"],
                "capabilities": ["metadata", "geometry", "properties", "spatial"],
            },
            {
                "extension": ".ifczip",
                "name": "Compressed IFC",
                "versions": ["IFC 2x3", "IFC 4", "IFC 4.3"],
                "capabilities": ["metadata", "geometry", "properties", "spatial"],
            },
        ],
        "max_file_size_mb": 100,
        "processing_capabilities": {
            "metadata_extraction": True,
            "geometry_conversion": True,
            "thumbnail_generation": True,
            "structural_analysis": True,
            "risk_assessment": True,
        },
    }
