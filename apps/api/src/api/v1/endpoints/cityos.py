"""CityOS (City Operating System) module API endpoints."""
import re
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.modules.cityos.service import CityOSService
from src.modules.cityos.models import CityTwin, MigrationRoute
from src.services.module_audit import log_module_action

router = APIRouter()


class CityCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    country_code: str = Field(..., min_length=2, max_length=2)
    region: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    population: Optional[int] = None
    description: Optional[str] = None
    capacity_notes: Optional[str] = None


class CityResponse(BaseModel):
    id: str
    cityos_id: str
    name: str
    country_code: str
    region: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    population: Optional[int] = None
    description: Optional[str] = None
    capacity_notes: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class MigrationRouteCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    origin_city_id: Optional[str] = None
    destination_city_id: Optional[str] = None
    estimated_flow_per_year: Optional[int] = None
    driver_type: Optional[str] = None
    description: Optional[str] = None


class MigrationRouteResponse(BaseModel):
    id: str
    cityos_id: str
    name: str
    origin_city_id: Optional[str] = None
    destination_city_id: Optional[str] = None
    estimated_flow_per_year: Optional[int] = None
    driver_type: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


def _city_to_response(c: CityTwin) -> CityResponse:
    return CityResponse(
        id=c.id,
        cityos_id=c.cityos_id,
        name=c.name,
        country_code=c.country_code,
        region=c.region,
        latitude=c.latitude,
        longitude=c.longitude,
        population=c.population,
        description=c.description,
        capacity_notes=c.capacity_notes,
        created_at=c.created_at.isoformat() if c.created_at else None,
    )


def _route_to_response(r: MigrationRoute) -> MigrationRouteResponse:
    return MigrationRouteResponse(
        id=r.id,
        cityos_id=r.cityos_id,
        name=r.name,
        origin_city_id=r.origin_city_id,
        destination_city_id=r.destination_city_id,
        estimated_flow_per_year=r.estimated_flow_per_year,
        driver_type=r.driver_type,
        description=r.description,
        created_at=r.created_at.isoformat() if r.created_at else None,
    )


@router.get("/cities", response_model=List[CityResponse])
async def list_cities(
    country_code: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    svc = CityOSService(db)
    cities = await svc.list_cities(country_code=country_code, limit=limit, offset=offset)
    return [_city_to_response(c) for c in cities]


@router.post("/cities", response_model=CityResponse)
async def create_city(body: CityCreate, db: AsyncSession = Depends(get_db)):
    svc = CityOSService(db)
    city = await svc.create_city(
        name=body.name,
        country_code=body.country_code.upper(),
        region=body.region,
        latitude=body.latitude,
        longitude=body.longitude,
        population=body.population,
        description=body.description,
        capacity_notes=body.capacity_notes,
    )
    await log_module_action(db, "cityos", "create", entity_type="city", entity_id=city.id, details={"cityos_id": city.cityos_id, "name": city.name})
    await db.commit()
    await db.refresh(city)
    return _city_to_response(city)


@router.get("/cities/{city_id}", response_model=CityResponse)
async def get_city(city_id: str, db: AsyncSession = Depends(get_db)):
    svc = CityOSService(db)
    city = await svc.get_city(city_id)
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    return _city_to_response(city)


@router.get("/migration-routes", response_model=List[MigrationRouteResponse])
async def list_migration_routes(
    origin_city_id: Optional[str] = Query(None),
    destination_city_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    svc = CityOSService(db)
    routes = await svc.list_migration_routes(
        origin_city_id=origin_city_id,
        destination_city_id=destination_city_id,
        limit=limit,
        offset=offset,
    )
    return [_route_to_response(r) for r in routes]


@router.post("/migration-routes", response_model=MigrationRouteResponse)
async def create_migration_route(body: MigrationRouteCreate, db: AsyncSession = Depends(get_db)):
    svc = CityOSService(db)
    route = await svc.create_migration_route(
        name=body.name,
        origin_city_id=body.origin_city_id,
        destination_city_id=body.destination_city_id,
        estimated_flow_per_year=body.estimated_flow_per_year,
        driver_type=body.driver_type,
        description=body.description,
    )
    await log_module_action(db, "cityos", "create", entity_type="migration_route", entity_id=route.id, details={"cityos_id": route.cityos_id, "name": route.name})
    await db.commit()
    await db.refresh(route)
    return _route_to_response(route)


@router.get("/forecast")
async def get_forecast(
    city_id: Optional[str] = Query(None),
    scenario: str = Query("capacity_planning"),
    db: AsyncSession = Depends(get_db),
):
    svc = CityOSService(db)
    result = await svc.get_forecast(city_id=city_id, scenario=scenario)
    await log_module_action(db, "cityos", "get_forecast", entity_type="forecast", details={"city_id": city_id, "scenario": scenario})
    await db.commit()
    return result


class IngestRequest(BaseModel):
    """Ingest cities from Overpass (bbox) or by country (future)."""
    bbox: Optional[List[float]] = Field(
        None,
        description="[min_lat, min_lon, max_lat, max_lon]",
    )
    country: Optional[str] = Field(None, description="Country code for future use")
    limit: int = Field(500, ge=1, le=2000)


@router.post("/ingest")
async def cityos_ingest(
    body: IngestRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest cities from OpenStreetMap Overpass (bbox). Creates CityTwin records with dedup by (name, country_code).
    """
    if not body.bbox or len(body.bbox) != 4:
        raise HTTPException(status_code=400, detail="bbox required: [min_lat, min_lon, max_lat, max_lon]")
    from src.data_federation.adapters.registry import get_adapter
    from src.data_federation.adapters.base import Region

    adapter = get_adapter("overpass")
    if not adapter:
        raise HTTPException(status_code=503, detail="Overpass adapter not available")
    region = Region(bbox=(body.bbox[0], body.bbox[1], body.bbox[2], body.bbox[3]))
    result = await adapter.fetch(region, limit=body.limit)
    cities_data = result.data.get("cities") or []
    existing = await db.execute(
        select(CityTwin.name, CityTwin.country_code).distinct()
    )
    existing_pairs = {(r[0], r[1]) for r in existing.fetchall()}
    added = 0
    slug = lambda s: re.sub(r"[^a-zA-Z0-9]+", "_", (s or "").strip())[:50]
    for item in cities_data:
        name = (item.get("name") or "").strip()[:255]
        if not name:
            continue
        cc = (item.get("country_code") or "XX").upper()[:2]
        if (name, cc) in existing_pairs:
            continue
        cityos_id = f"CITYOS-OVERPASS-{cc}-{slug(name)}"[:100]
        dup = await db.execute(select(CityTwin.id).where(CityTwin.cityos_id == cityos_id))
        if dup.scalar_one_or_none():
            continue
        city = CityTwin(
            id=str(uuid4()),
            cityos_id=cityos_id,
            name=name,
            country_code=cc,
            latitude=item.get("lat"),
            longitude=item.get("lon"),
            population=item.get("population"),
            description="Ingested from Overpass",
        )
        db.add(city)
        existing_pairs.add((name, cc))
        added += 1
    await db.commit()
    return {"ingested": added, "from_overpass": len(cities_data)}


@router.get("/cities/{city_id}/climate-exposure")
async def city_climate_exposure(city_id: str, db: AsyncSession = Depends(get_db)):
    """Climate exposure scoring for a city."""
    svc = CityOSService(db)
    return await svc.get_climate_exposure(city_id)


@router.get("/migration-analytics")
async def migration_analytics(db: AsyncSession = Depends(get_db)):
    """Migration flow analytics across all cities (Sankey data included)."""
    svc = CityOSService(db)
    return await svc.get_migration_analytics()


@router.get("/dashboard")
async def cityos_dashboard(db: AsyncSession = Depends(get_db)):
    """Aggregate CityOS dashboard data."""
    svc = CityOSService(db)
    return await svc.get_dashboard()


@router.get("/status")
async def cityos_status(db: AsyncSession = Depends(get_db)) -> dict:
    svc = CityOSService(db)
    cities = await svc.list_cities(limit=1000)
    routes = await svc.list_migration_routes(limit=1000)
    return {
        "module": "cityos",
        "status": "operational",
        "enabled": True,
        "cities_count": len(cities),
        "migration_routes_count": len(routes),
        "total_population": sum(c.population or 0 for c in cities),
        "countries": list({c.country_code for c in cities}),
    }
