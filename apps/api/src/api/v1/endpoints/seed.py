"""
Seed data endpoints - For development and demos.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import delete, select, func
from sqlalchemy.exc import OperationalError, IntegrityError, ProgrammingError
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
from src.services.seed_data import seed_all, seed_modules_only, refresh_twin_geometry_from_asset_type
from src.services.knowledge_graph import get_knowledge_graph_service
from src.services.strategic_modules_seed import seed_strategic_modules, seed_srs
from src.modules.cityos.seed_cities import seed_cityos_cities
from src.services.ingestion.seed_ingestion_sources import seed_ingestion_sources_if_empty

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
    try:
        user = await get_current_user(credentials=credentials, db=db)
    except OperationalError as e:
        logger.warning("Seed auth check failed (database): %s", e)
        raise HTTPException(
            status_code=503,
            detail="Database schema outdated. On server run: cd apps/api && alembic upgrade head",
        ) from e
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
    except (OperationalError, ProgrammingError) as e:
        logger.warning("Seed failed (database schema): %s", e)
        raise HTTPException(
            status_code=503,
            detail=(
                "Database schema outdated or missing tables. "
                "On server run: cd apps/api && alembic upgrade head. "
                "Then restart the API."
            ),
        ) from e
    except IntegrityError as e:
        logger.warning("Seed failed (constraint): %s", e)
        raise HTTPException(
            status_code=409,
            detail="Data already exists or constraint violation. Clear demo data first or use a fresh database.",
        ) from e
    except Exception as e:
        logger.exception("Seed failed: %s", e)
        err_msg = str(e)
        hint = ""
        if any(x in err_msg.lower() for x in ("no such table", "does not exist", "column", "syntax")):
            hint = " (Tip: run 'cd apps/api && alembic upgrade head' on server)"
        raise HTTPException(
            status_code=500,
            detail=f"Seeding failed: {err_msg}{hint}",
        )


@router.post("/strategic-modules")
async def seed_strategic_modules_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(_require_admin_or_allow_dev),
):
    """
    Seed strategic modules (CIP, SCSS, SRO) with 6 entities each + relationships.

    - CIP: 6 infrastructure assets (power, water, telecom, data center, emergency) + dependencies
    - SCSS: 6 suppliers (raw materials, components, logistics) + supply routes
    - SRO: 6 financial institutions (banks, insurance, clearing) + correlations + indicators

    Idempotent: skips a module if it already has 6+ entities.
    In development or ALLOW_SEED_IN_PRODUCTION=true: no auth.
    """
    if settings.environment == "production" and not getattr(settings, "allow_seed_in_production", False):
        raise HTTPException(
            status_code=403,
            detail="Seeding is disabled in production. Set ALLOW_SEED_IN_PRODUCTION=true for demo servers.",
        )
    try:
        result = await seed_strategic_modules(db)
        return {"status": "success", **result}
    except OperationalError as e:
        logger.warning("Strategic modules seed failed (schema): %s", e)
        raise HTTPException(
            status_code=503,
            detail="Database schema outdated. On server run: cd apps/api && alembic upgrade head",
        ) from e
    except Exception as e:
        logger.exception("Strategic modules seed failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/srs")
async def seed_srs_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(_require_admin_or_allow_dev),
):
    """
    Seed SRS (Sovereign Risk Shield) with demo sovereign funds and resource deposits.
    Idempotent: skips if already populated. Use to populate the SRS module for demos.
    """
    if settings.environment == "production" and not getattr(settings, "allow_seed_in_production", False):
        raise HTTPException(
            status_code=403,
            detail="Seeding is disabled in production. Set ALLOW_SEED_IN_PRODUCTION=true for demo servers.",
        )
    try:
        result = await seed_srs(db)
        return {"status": "success", "message": f"SRS: {result.get('srs_funds', 0)} funds, {result.get('srs_deposits', 0)} deposits.", **result}
    except Exception as e:
        logger.exception("SRS seed failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cityos")
async def seed_cityos(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(_require_admin_or_allow_dev),
):
    """
    Seed CityOS city twins from demo_communities (pilot cities for CityOS module).
    Idempotent: skips cities that already exist. Use to populate digital twin cities for CityOS.
    """
    if settings.environment == "production" and not getattr(settings, "allow_seed_in_production", False):
        raise HTTPException(
            status_code=403,
            detail="Seeding is disabled in production. Set ALLOW_SEED_IN_PRODUCTION=true for demo servers.",
        )
    try:
        result = await seed_cityos_cities(db)
        return {"status": "success", "message": f"CityOS: {result['added']} city twins added.", **result}
    except Exception as e:
        logger.exception("CityOS seed failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingestion-sources")
async def seed_ingestion_sources(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(_require_admin_or_allow_dev),
):
    """
    Seed default ingestion_sources (natural_hazards, weather, etc.) if the catalog is empty.
    Run once after DB migration so scheduled ingestion and catalog-driven jobs have sources.
    """
    if settings.environment == "production" and not getattr(settings, "allow_seed_in_production", False):
        raise HTTPException(
            status_code=403,
            detail="Seeding is disabled in production. Set ALLOW_SEED_IN_PRODUCTION=true for demo servers.",
        )
    try:
        result = await seed_ingestion_sources_if_empty(db)
        return {"status": "success", **result}
    except Exception as e:
        logger.exception("Ingestion sources seed failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


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
    except OperationalError as e:
        logger.warning("Seed modules failed (schema): %s", e)
        raise HTTPException(
            status_code=503,
            detail="Database schema outdated. On server run: cd apps/api && alembic upgrade head",
        ) from e
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

    # ---------------------------------------------------------------------------
    # Building GLB models from Kenney City Kit Commercial (CC0)
    # Served from frontend public/models/buildings/
    # ---------------------------------------------------------------------------
    _B = "/models/buildings"
    items = [
        # --- Skyscrapers (office towers, HQs) ---
        {
            "domain": "city",
            "kind": "office_tower",
            "category": "commercial",
            "name": "Office Tower A",
            "description": "Modern glass skyscraper for corporate HQ and office assets.",
            "tags": ["office", "skyscraper", "tower", "commercial"],
            "source": "kenney_city_kit",
            "source_url": "https://kenney.nl/assets/city-kit-commercial",
            "glb_object": f"{_B}/skyscraper-a.glb",
            "license": "CC0 1.0 (Kenney)",
        },
        {
            "domain": "city",
            "kind": "office_tower",
            "category": "commercial",
            "name": "Office Tower B",
            "description": "Tall commercial building with distinctive facade.",
            "tags": ["office", "skyscraper", "tower", "commercial"],
            "source": "kenney_city_kit",
            "source_url": "https://kenney.nl/assets/city-kit-commercial",
            "glb_object": f"{_B}/skyscraper-b.glb",
            "license": "CC0 1.0 (Kenney)",
        },
        {
            "domain": "city",
            "kind": "office_tower",
            "category": "commercial",
            "name": "Financial Center Tower",
            "description": "High-rise building suitable for financial district.",
            "tags": ["finance", "skyscraper", "tower", "bank"],
            "source": "kenney_city_kit",
            "source_url": "https://kenney.nl/assets/city-kit-commercial",
            "glb_object": f"{_B}/skyscraper-c.glb",
            "license": "CC0 1.0 (Kenney)",
        },
        {
            "domain": "factory",
            "kind": "datacenter",
            "category": "industrial",
            "name": "Data Center Tower",
            "description": "Multi-storey data center building for IT infrastructure assets.",
            "tags": ["datacenter", "server", "IT", "tower"],
            "source": "kenney_city_kit",
            "source_url": "https://kenney.nl/assets/city-kit-commercial",
            "glb_object": f"{_B}/skyscraper-d.glb",
            "license": "CC0 1.0 (Kenney)",
        },
        {
            "domain": "city",
            "kind": "mixed_use",
            "category": "commercial",
            "name": "Mixed-Use Tower",
            "description": "Versatile high-rise for retail, office, or mixed-use assets.",
            "tags": ["mixed", "retail", "office", "tower"],
            "source": "kenney_city_kit",
            "source_url": "https://kenney.nl/assets/city-kit-commercial",
            "glb_object": f"{_B}/skyscraper-e.glb",
            "license": "CC0 1.0 (Kenney)",
        },
        # --- Mid-rise / commercial buildings ---
        {
            "domain": "city",
            "kind": "commercial_building",
            "category": "commercial",
            "name": "Commercial Building A",
            "description": "Mid-rise commercial building for retail and office use.",
            "tags": ["commercial", "retail", "office", "midrise"],
            "source": "kenney_city_kit",
            "source_url": "https://kenney.nl/assets/city-kit-commercial",
            "glb_object": f"{_B}/commercial-a.glb",
            "license": "CC0 1.0 (Kenney)",
        },
        {
            "domain": "city",
            "kind": "commercial_building",
            "category": "commercial",
            "name": "Commercial Building B",
            "description": "Urban commercial block with storefronts.",
            "tags": ["commercial", "retail", "urban"],
            "source": "kenney_city_kit",
            "source_url": "https://kenney.nl/assets/city-kit-commercial",
            "glb_object": f"{_B}/commercial-b.glb",
            "license": "CC0 1.0 (Kenney)",
        },
        # --- Residential ---
        {
            "domain": "city",
            "kind": "residential",
            "category": "residential",
            "name": "Apartment Building",
            "description": "Multi-family residential building.",
            "tags": ["residential", "apartment", "housing"],
            "source": "kenney_city_kit",
            "source_url": "https://kenney.nl/assets/city-kit-commercial",
            "glb_object": f"{_B}/lowrise-a.glb",
            "license": "CC0 1.0 (Kenney)",
        },
        {
            "domain": "city",
            "kind": "residential",
            "category": "residential",
            "name": "Residential House",
            "description": "Single-family or small residential building.",
            "tags": ["residential", "house", "single-family"],
            "source": "kenney_city_kit",
            "source_url": "https://kenney.nl/assets/city-kit-commercial",
            "glb_object": f"{_B}/lowrise-b.glb",
            "license": "CC0 1.0 (Kenney)",
        },
        # --- Industrial / logistics ---
        {
            "domain": "factory",
            "kind": "industrial",
            "category": "industrial",
            "name": "Industrial Facility",
            "description": "Factory or manufacturing building for industrial assets.",
            "tags": ["industrial", "factory", "manufacturing"],
            "source": "kenney_city_kit",
            "source_url": "https://kenney.nl/assets/city-kit-commercial",
            "glb_object": f"{_B}/industrial-a.glb",
            "license": "CC0 1.0 (Kenney)",
        },
        {
            "domain": "factory",
            "kind": "warehouse",
            "category": "industrial",
            "name": "Logistics Warehouse",
            "description": "Distribution center or warehouse for logistics assets.",
            "tags": ["logistics", "warehouse", "distribution"],
            "source": "kenney_city_kit",
            "source_url": "https://kenney.nl/assets/city-kit-commercial",
            "glb_object": f"{_B}/facility-a.glb",
            "license": "CC0 1.0 (Kenney)",
        },
        # --- Infrastructure / public ---
        {
            "domain": "city",
            "kind": "infrastructure",
            "category": "public",
            "name": "Infrastructure Complex",
            "description": "Public infrastructure building (power, water, transport hub).",
            "tags": ["infrastructure", "public", "utility", "power"],
            "source": "kenney_city_kit",
            "source_url": "https://kenney.nl/assets/city-kit-commercial",
            "glb_object": f"{_B}/complex-a.glb",
            "license": "CC0 1.0 (Kenney)",
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


@router.post("/refresh-twin-models")
async def refresh_twin_models(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(_require_admin_or_allow_dev),
):
    """
    Update existing Digital Twins: set 3D building model (geometry_path) from asset type.
    Use when demo was loaded earlier and you want to see the new building GLBs without clearing/re-seeding.
    """
    if settings.environment == "production" and not getattr(settings, "allow_seed_in_production", False):
        raise HTTPException(status_code=403, detail="Seeding is disabled in production")
    try:
        updated = await refresh_twin_geometry_from_asset_type(db)
        return {"status": "success", "updated": updated, "message": f"Updated {updated} digital twin(s) with building models."}
    except Exception as e:
        logger.exception("Refresh twin models failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


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
