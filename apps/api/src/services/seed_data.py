"""
Seed sample data for alpha users and demos.

Creates:
- Sample assets with realistic data
- Digital twins with timelines
- Knowledge graph relationships
- Sample provenance records
"""
import logging
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.asset import Asset, AssetType, AssetStatus
from src.models.digital_twin import DigitalTwin, TwinState, TwinTimeline
from src.models.provenance import DataProvenance, VerificationStatus
from src.services.knowledge_graph import get_knowledge_graph_service

logger = logging.getLogger(__name__)


SAMPLE_ASSETS = [
    {
        "name": "Munich Office Tower",
        "asset_type": AssetType.COMMERCIAL_OFFICE,
        "city": "Munich",
        "country_code": "DE",
        "latitude": 48.1351,
        "longitude": 11.5820,
        "gross_floor_area_m2": 45000,
        "floors_above_ground": 18,
        "year_built": 2015,
        "current_valuation": 120_000_000,
        "climate_risk_score": 45,
        "physical_risk_score": 22,
        "network_risk_score": 68,
        "description": "Modern office tower in central Munich with LEED Gold certification",
    },
    {
        "name": "Berlin Data Center",
        "asset_type": AssetType.DATA_CENTER,
        "city": "Berlin",
        "country_code": "DE",
        "latitude": 52.5200,
        "longitude": 13.4050,
        "gross_floor_area_m2": 12000,
        "floors_above_ground": 3,
        "year_built": 2018,
        "current_valuation": 85_000_000,
        "climate_risk_score": 28,
        "physical_risk_score": 15,
        "network_risk_score": 82,
        "description": "Tier III data center with redundant power and cooling",
    },
    {
        "name": "Hamburg Logistics Hub",
        "asset_type": AssetType.LOGISTICS,
        "city": "Hamburg",
        "country_code": "DE",
        "latitude": 53.5511,
        "longitude": 9.9937,
        "gross_floor_area_m2": 75000,
        "floors_above_ground": 1,
        "year_built": 2010,
        "current_valuation": 65_000_000,
        "climate_risk_score": 72,
        "physical_risk_score": 38,
        "network_risk_score": 45,
        "description": "Large logistics and distribution center near port",
    },
    {
        "name": "Frankfurt Financial District Office",
        "asset_type": AssetType.COMMERCIAL_OFFICE,
        "city": "Frankfurt",
        "country_code": "DE",
        "latitude": 50.1109,
        "longitude": 8.6821,
        "gross_floor_area_m2": 28000,
        "floors_above_ground": 12,
        "year_built": 2012,
        "current_valuation": 95_000_000,
        "climate_risk_score": 35,
        "physical_risk_score": 18,
        "network_risk_score": 55,
        "description": "Premium office space in Frankfurt's financial district",
    },
    {
        "name": "Stuttgart Industrial Complex",
        "asset_type": AssetType.INDUSTRIAL,
        "city": "Stuttgart",
        "country_code": "DE",
        "latitude": 48.7758,
        "longitude": 9.1829,
        "gross_floor_area_m2": 55000,
        "floors_above_ground": 2,
        "year_built": 2005,
        "current_valuation": 45_000_000,
        "climate_risk_score": 38,
        "physical_risk_score": 42,
        "network_risk_score": 35,
        "description": "Manufacturing and warehouse facility",
    },
]


async def seed_sample_assets(db: AsyncSession) -> list[Asset]:
    """
    Seed sample assets for demo/alpha users.
    
    Returns list of created assets.
    """
    from geoalchemy2.functions import ST_SetSRID, ST_MakePoint
    from sqlalchemy import func
    
    created_assets = []
    
    for asset_data in SAMPLE_ASSETS:
        asset_id = uuid4()
        
        # Generate PARS ID
        city_code = asset_data["city"][:3].upper()
        pars_id = f"PARS-EU-{asset_data['country_code']}-{city_code}-{asset_id.hex[:8].upper()}"
        
        # Create location point
        location = func.ST_SetSRID(
            func.ST_MakePoint(asset_data["longitude"], asset_data["latitude"]),
            4326,
        )
        
        asset = Asset(
            id=asset_id,
            pars_id=pars_id,
            name=asset_data["name"],
            description=asset_data["description"],
            asset_type=asset_data["asset_type"],
            status=AssetStatus.ACTIVE,
            location=location,
            city=asset_data["city"],
            country_code=asset_data["country_code"],
            gross_floor_area_m2=asset_data["gross_floor_area_m2"],
            floors_above_ground=asset_data["floors_above_ground"],
            year_built=asset_data["year_built"],
            current_valuation=asset_data["current_valuation"],
            valuation_currency="EUR",
            climate_risk_score=asset_data["climate_risk_score"],
            physical_risk_score=asset_data["physical_risk_score"],
            network_risk_score=asset_data["network_risk_score"],
            tags=["sample", "demo"],
        )
        
        db.add(asset)
        created_assets.append(asset)
    
    await db.commit()
    
    # Refresh to get IDs
    for asset in created_assets:
        await db.refresh(asset)
    
    logger.info(f"Seeded {len(created_assets)} sample assets")
    return created_assets


async def seed_digital_twins(db: AsyncSession, assets: list[Asset]) -> list[DigitalTwin]:
    """Create digital twins for assets with sample timeline."""
    twins = []
    
    for asset in assets:
        twin = DigitalTwin(
            id=uuid4(),
            asset_id=asset.id,
            state=TwinState.SYNCHRONIZED,
            last_sync_at=datetime.utcnow(),
            sync_source="seed_data",
            geometry_type="ifc",
            structural_integrity=100 - (asset.physical_risk_score or 0),
            condition_score=100 - (asset.physical_risk_score or 0) * 0.8,
            remaining_useful_life_years=50 - (2024 - (asset.year_built or 2024)),
            sensor_data={
                "temperature": 22.5,
                "humidity": 45,
                "occupancy": 0.85,
            },
            sensor_updated_at=datetime.utcnow(),
            climate_exposures={
                "flood": {"score": 30, "depth_100yr": 0.8},
                "heat": {"score": 40, "cooling_days": 450},
                "wind": {"score": 25, "max_gust": 38},
            },
            climate_exposures_updated_at=datetime.utcnow(),
            infrastructure_dependencies={
                "power": {"grid_sector": "sector_7", "criticality": 0.9},
                "water": {"district": "district_a", "criticality": 0.6},
            },
            financial_metrics={
                "pd": 0.018,
                "lgd": 0.32,
                "current_valuation": asset.current_valuation,
            },
            financial_updated_at=datetime.utcnow(),
        )
        
        db.add(twin)
        twins.append(twin)
        
        # Create timeline events
        timeline_events = [
            {
                "event_type": "genesis",
                "event_date": datetime(asset.year_built or 2015, 1, 1),
                "event_title": "Building Constructed",
                "event_description": f"Construction completed in {asset.year_built}",
                "source": "historical_record",
            },
            {
                "event_type": "renovation",
                "event_date": datetime(asset.year_built or 2015, 1, 1) + timedelta(days=1460),
                "event_title": "HVAC System Upgrade",
                "event_description": "Major HVAC system renovation",
                "source": "maintenance_record",
            },
            {
                "event_type": "inspection",
                "event_date": datetime.utcnow() - timedelta(days=90),
                "event_title": "Annual Structural Inspection",
                "event_description": "Routine structural assessment",
                "source": "inspection_company",
            },
            {
                "event_type": "sensor",
                "event_date": datetime.utcnow() - timedelta(hours=1),
                "event_title": "IoT Sensors Installed",
                "event_description": "Real-time monitoring system activated",
                "source": "iot_platform",
            },
        ]
        
        for event_data in timeline_events:
            timeline = TwinTimeline(
                id=uuid4(),
                digital_twin_id=twin.id,
                event_type=event_data["event_type"],
                event_date=event_data["event_date"],
                event_title=event_data["event_title"],
                event_description=event_data["event_description"],
                source=event_data["source"],
            )
            db.add(timeline)
    
    await db.commit()
    
    for twin in twins:
        await db.refresh(twin)
    
    logger.info(f"Created {len(twins)} digital twins with timelines")
    return twins


async def seed_knowledge_graph(assets: list[Asset]):
    """Seed knowledge graph with infrastructure and dependencies."""
    kg_service = get_knowledge_graph_service()
    
    # Initialize schema
    await kg_service.initialize_schema()
    
    # Create infrastructure nodes
    infrastructure = [
        {
            "id": "power_grid_sector_7",
            "name": "Power Grid Sector 7",
            "type": "power_grid",
            "capacity": 500.0,
            "region": "Munich",
        },
        {
            "id": "power_grid_sector_12",
            "name": "Power Grid Sector 12",
            "type": "power_grid",
            "capacity": 350.0,
            "region": "Berlin",
        },
        {
            "id": "water_district_a",
            "name": "Water District A",
            "type": "water",
            "capacity": 1000.0,
        },
        {
            "id": "telecom_hub_central",
            "name": "Central Telecom Hub",
            "type": "telecom",
            "capacity": 10000.0,
        },
    ]
    
    for infra in infrastructure:
        await kg_service.create_infrastructure_node(
            infra_id=infra["id"],
            name=infra["name"],
            infra_type=infra["type"],
            capacity=infra["capacity"],
            region=infra.get("region"),
        )
    
    # Create asset nodes and dependencies
    for asset in assets:
        await kg_service.create_asset_node(
            asset_id=asset.id,
            name=asset.name,
            asset_type=asset.asset_type.value,
            latitude=48.0,  # Would extract from location
            longitude=11.0,
            valuation=asset.current_valuation,
        )
        
        # Create dependencies based on location
        if "Munich" in asset.city:
            await kg_service.create_dependency(
                source_id=str(asset.id),
                target_id="power_grid_sector_7",
                dependency_type="DEPENDS_ON",
                criticality=0.9,
            )
        elif "Berlin" in asset.city:
            await kg_service.create_dependency(
                source_id=str(asset.id),
                target_id="power_grid_sector_12",
                dependency_type="DEPENDS_ON",
                criticality=0.85,
            )
        
        # All assets depend on water
        await kg_service.create_dependency(
            source_id=str(asset.id),
            target_id="water_district_a",
            dependency_type="DEPENDS_ON",
            criticality=0.6,
        )
        
        # Data centers depend on telecom
        if asset.asset_type == AssetType.DATA_CENTER:
            await kg_service.create_dependency(
                source_id=str(asset.id),
                target_id="telecom_hub_central",
                dependency_type="DEPENDS_ON",
                criticality=0.95,
            )
    
    logger.info("Seeded knowledge graph with infrastructure and dependencies")


async def seed_all(db: AsyncSession):
    """
    Seed all sample data for alpha users.
    
    Creates:
    - Sample assets
    - Digital twins with timelines
    - Knowledge graph relationships
    """
    logger.info("Starting data seeding...")
    
    # Seed assets
    assets = await seed_sample_assets(db)
    
    # Seed digital twins
    twins = await seed_digital_twins(db, assets)
    
    # Seed knowledge graph
    await seed_knowledge_graph(assets)
    
    logger.info("Data seeding completed successfully")
    
    return {
        "assets_created": len(assets),
        "twins_created": len(twins),
        "infrastructure_nodes": 4,
    }
