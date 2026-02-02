"""
Seed data endpoints - For development and demos.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import delete, select, func
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.core.security import get_current_user, require_admin
from src.models.user import User
from src.models.user import UserRole
from src.models.asset import Asset
from src.models.digital_twin import DigitalTwin, TwinTimeline
from src.models.provenance import DataProvenance
from src.models.stress_test import StressTest, RiskZone, ZoneAsset, StressTestReport, ActionPlan
from src.models.historical_event import HistoricalEvent
from src.models.twin_asset_library import TwinAssetLibraryItem
from src.services.seed_data import seed_all, seed_modules_only
from src.services.knowledge_graph import get_knowledge_graph_service

logger = logging.getLogger(__name__)

router = APIRouter()

_optional_bearer = HTTPBearer(auto_error=False)


async def _require_admin_or_allow_dev(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """In development or when allow_seed_in_production: no auth. In production otherwise: require admin."""
    if settings.environment == "development":
        return None
    if getattr(settings, "allow_seed_in_production", False):
        return None
    user = await get_current_user(credentials=credentials, db=db)
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Seeding requires admin role")
    return user


@router.post("/seed")
async def seed_sample_data(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(_require_admin_or_allow_dev),
):
    """
    Seed sample data for demos and alpha users.
    
    Creates 100+ sample assets (Munich, Berlin, Madrid, NY, etc.), digital twins, knowledge graph.
    In development or when ALLOW_SEED_IN_PRODUCTION=true: no auth, seeding allowed.
    In production otherwise: disabled (403).
    """
    if settings.environment == "production" and not getattr(settings, "allow_seed_in_production", False):
        raise HTTPException(
            status_code=403,
            detail="Seeding is disabled in production. Set ALLOW_SEED_IN_PRODUCTION=true for demo servers.",
        )

    try:
        result = await seed_all(db)
        return {
            "status": "success",
            "message": result.get("message", "Sample data seeded successfully"),
            **result,
        }
    except Exception as e:
        logger.exception("Seed failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"Seeding failed: {str(e)}",
        )


@router.post("/seed-modules")
async def seed_modules(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(_require_admin_or_allow_dev),
):
    """
    Seed only portfolios, projects, and fraud claims using existing assets.
    Use when assets already exist to avoid duplicating assets. If no assets exist, returns 400.
    """
    if settings.environment == "production" and not getattr(settings, "allow_seed_in_production", False):
        raise HTTPException(
            status_code=403,
            detail="Seeding is disabled in production.",
        )
    try:
        result = await seed_modules_only(db)
        if result.get("error") == "no_assets":
            raise HTTPException(status_code=400, detail=result.get("message", "No assets in database."))
        return {"status": "success", **result}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Seed modules failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/twin-assets")
async def seed_twin_asset_library(
    overwrite: bool = False,
    db: AsyncSession = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
):
    """
    Seed the Twin Asset Library catalog (dev/demo).

    This does not download real USD packs (deployment-specific),
    but creates catalog rows pointing to recommended Nucleus paths.
    In production allowed when ALLOW_SEED_IN_PRODUCTION=true (no auth).
    """
    if settings.environment == "production" and not getattr(settings, "allow_seed_in_production", False):
        raise HTTPException(status_code=403, detail="Seeding is disabled in production")

    # In production with allow_seed_in_production, or in development: no auth.
    if settings.environment == "development" or getattr(settings, "allow_seed_in_production", False):
        pass  # no auth
    else:
        if credentials is None:
            raise HTTPException(status_code=401, detail="Authentication required")
        user = await get_current_user(credentials=credentials, db=db)
        if user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Requires admin role")

    if overwrite:
        await db.execute(delete(TwinAssetLibraryItem))

    if not overwrite:
        existing = await db.execute(select(func.count()).select_from(TwinAssetLibraryItem))
        if (existing.scalar() or 0) > 0:
            return {"status": "skipped", "message": "Twin Asset Library already has entries"}

    import json as _json
    from datetime import datetime as _dt
    from uuid import uuid4 as _uuid4

    base = (settings.nucleus_library_root or "/Library").rstrip("/") or "/Library"
    # One demo item with public GLB URL — shows as "Ready" without conversion
    demo_glb_url = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb"
    items = [
        {
            "domain": "demo",
            "kind": "building",
            "category": "commercial",
            "name": "Demo Duck (GLB)",
            "description": "Sample GLB for 3D View. Attach to any asset to see it in the viewer.",
            "tags": ["demo", "glb", "sample"],
            "source": "gltf_sample_models",
            "usd_path": None,
            "glb_object": demo_glb_url,
            "license": "CC0 (Khronos glTF Sample Models)",
        },
        {
            "domain": "factory",
            "kind": "factory_plant",
            "category": "industrial",
            "name": "Generic Factory Plant (OpenUSD master)",
            "description": "Starter factory plant scene. Use as a template for client-specific twins.",
            "tags": ["factory", "plant", "simready", "template"],
            "source": "nvidia_blueprint",
            "usd_path": f"{base}/Factory/Plants/generic_factory.usd",
            "license": "NVIDIA sample content / check pack license",
        },
        {
            "domain": "factory",
            "kind": "datacenter",
            "category": "industrial",
            "name": "AI/Data Center Hall (OpenUSD master)",
            "description": "Reference datacenter hall layout for downtime/cascade scenarios.",
            "tags": ["datacenter", "power", "cooling"],
            "source": "nvidia_blueprint",
            "usd_path": f"{base}/Factory/Plants/datacenter_hall.usd",
            "license": "NVIDIA blueprint / check license",
        },
        {
            "domain": "city",
            "kind": "city_block",
            "category": "public",
            "name": "City Block (Downtown) - Placeholder",
            "description": "City-scale context recommended via 3D Tiles; USD used only for focus assets.",
            "tags": ["city", "block", "context"],
            "source": "open_city",
            "usd_path": f"{base}/City/Blocks/downtown_block.usd",
            "license": "Open data / attribution required",
        },
        {
            "domain": "city",
            "kind": "infrastructure",
            "category": "public",
            "name": "Substation / Grid Node (OpenUSD master)",
            "description": "Infrastructure node for cascade/network risk scenarios.",
            "tags": ["grid", "infrastructure", "cascade"],
            "source": "nvidia_pack",
            "usd_path": f"{base}/City/Infrastructure/substation.usd",
            "license": "NVIDIA sample content / check pack license",
        },
        {
            "domain": "finance",
            "kind": "bank_hq",
            "category": "commercial",
            "name": "Bank HQ (Generic building) - Placeholder",
            "description": "Generic finance HQ building; real assets should come from client BIM/IFC.",
            "tags": ["finance", "bank", "hq"],
            "source": "template",
            "usd_path": f"{base}/Finance/Banking/bank_hq_generic.usd",
            "license": "Template",
        },
        {
            "domain": "finance",
            "kind": "insurance_hq",
            "category": "commercial",
            "name": "Insurance HQ (Generic building) - Placeholder",
            "description": "Generic insurer building; replace with client/partner models when available.",
            "tags": ["finance", "insurance", "hq"],
            "source": "template",
            "usd_path": f"{base}/Finance/Insurance/insurance_hq_generic.usd",
            "license": "Template",
        },
        {
            "domain": "factory",
            "kind": "port_terminal",
            "category": "industrial",
            "name": "Port Terminal (OpenUSD master) - Placeholder",
            "description": "Port terminal scene for logistics/chokepoint risk.",
            "tags": ["port", "logistics", "terminal"],
            "source": "template",
            "usd_path": f"{base}/Factory/Plants/port_terminal.usd",
            "license": "Template",
        },
    ]

    rows = []
    for it in items:
        rows.append(
            TwinAssetLibraryItem(
                id=str(_uuid4()),
                domain=it["domain"],
                kind=it["kind"],
                category=it.get("category"),
                name=it["name"],
                description=it.get("description"),
                tags=_json.dumps(it.get("tags", [])),
                license=it.get("license"),
                source=it.get("source"),
                source_url=it.get("source_url"),
                usd_path=it.get("usd_path"),
                glb_object=it.get("glb_object"),
                created_at=_dt.utcnow(),
            )
        )
    db.add_all(rows)
    try:
        await db.commit()
    except OperationalError as e:
        await db.rollback()
        if "category" in str(e).lower() or "no such column" in str(e).lower():
            raise HTTPException(
                status_code=503,
                detail="Database schema outdated: missing twin_asset_library.category. Run: cd apps/api && alembic upgrade head",
            ) from e
        raise

    return {"status": "success", "seeded": len(rows)}


@router.delete("/seed")
async def clear_sample_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Clear all sample data.
    
    WARNING: This deletes all assets, twins, stress tests, and related data.
    The Knowledge Graph is also cleared (if available).
    
    Requires ADMIN role.
    """
    if settings.environment == "production":
        raise HTTPException(
            status_code=403,
            detail="Clearing data is disabled in production",
        )
    
    counts = {}
    
    try:
        # Delete in correct order (respect foreign key constraints)
        
        # 1. Action plans (depend on reports)
        result = await db.execute(delete(ActionPlan))
        counts["action_plans"] = result.rowcount
        
        # 2. Stress test reports (depend on stress tests)
        result = await db.execute(delete(StressTestReport))
        counts["stress_test_reports"] = result.rowcount
        
        # 3. Zone assets (depend on zones and assets)
        result = await db.execute(delete(ZoneAsset))
        counts["zone_assets"] = result.rowcount
        
        # 4. Risk zones (depend on stress tests)
        result = await db.execute(delete(RiskZone))
        counts["risk_zones"] = result.rowcount
        
        # 5. Stress tests (depend on historical events)
        result = await db.execute(delete(StressTest))
        counts["stress_tests"] = result.rowcount
        
        # 6. Historical events
        result = await db.execute(delete(HistoricalEvent))
        counts["historical_events"] = result.rowcount
        
        # 7. Twin timelines (depend on twins)
        result = await db.execute(delete(TwinTimeline))
        counts["twin_timelines"] = result.rowcount
        
        # 8. Digital twins (depend on assets)
        result = await db.execute(delete(DigitalTwin))
        counts["digital_twins"] = result.rowcount
        
        # 9. Provenance records (depend on assets)
        result = await db.execute(delete(DataProvenance))
        counts["provenance_records"] = result.rowcount
        
        # 10. Assets
        result = await db.execute(delete(Asset))
        counts["assets"] = result.rowcount
        
        # Commit all deletions
        await db.commit()
        
        # Clear Knowledge Graph (Neo4j) if available
        kg_cleared = False
        try:
            kg_service = get_knowledge_graph_service()
            if kg_service:
                # Clear all nodes and relationships
                await kg_service.clear_all()
                kg_cleared = True
        except Exception as kg_error:
            logger.warning(f"Could not clear Knowledge Graph: {kg_error}")
        
        total_deleted = sum(counts.values())
        
        return {
            "status": "success",
            "message": f"Cleared {total_deleted} records",
            "deleted_counts": counts,
            "knowledge_graph_cleared": kg_cleared,
        }
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to clear data: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear data: {str(e)}",
        )
