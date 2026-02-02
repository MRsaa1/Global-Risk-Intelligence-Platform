"""
Seed sample data for alpha users and demos.

Creates:
- Sample assets with realistic data (5 named + ~95 demo buildings for 3D base)
- Digital twins with timelines
- Knowledge graph relationships
- Sample provenance records
- Sample portfolios, projects, and fraud claims (when tables are empty)
"""
import json
import logging
import random
from datetime import date, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select, func, update
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.asset import Asset, AssetType, AssetStatus
from src.models.digital_twin import DigitalTwin, TwinState, TwinTimeline
from src.models.provenance import DataProvenance, VerificationStatus
from src.models.portfolio import Portfolio, PortfolioAsset, PortfolioType
from src.models.project import Project, ProjectType, ProjectStatus
from src.models.fraud import DamageClaim, ClaimType, ClaimStatus, DamageType, FraudRiskLevel
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

# Demo cities for expanded base (like Microsoft/OSM import)
DEMO_CITIES = [
    {"city": "Munich", "country_code": "DE", "lat_center": 48.1351, "lon_center": 11.5820, "radius_deg": 0.08},
    {"city": "Berlin", "country_code": "DE", "lat_center": 52.5200, "lon_center": 13.4050, "radius_deg": 0.12},
    {"city": "Madrid", "country_code": "ES", "lat_center": 40.4168, "lon_center": -3.7038, "radius_deg": 0.10},
    {"city": "New York", "country_code": "US", "lat_center": 40.7128, "lon_center": -74.0060, "radius_deg": 0.08},
    {"city": "Hamburg", "country_code": "DE", "lat_center": 53.5511, "lon_center": 9.9937, "radius_deg": 0.06},
    {"city": "Frankfurt", "country_code": "DE", "lat_center": 50.1109, "lon_center": 8.6821, "radius_deg": 0.05},
]

DEMO_ASSET_TYPES = [
    (AssetType.COMMERCIAL_OFFICE, 8000, 25, 50_000_000),
    (AssetType.COMMERCIAL_RETAIL, 5000, 4, 30_000_000),
    (AssetType.RESIDENTIAL_MULTI, 12000, 15, 40_000_000),
    (AssetType.INDUSTRIAL, 20000, 2, 25_000_000),
    (AssetType.LOGISTICS, 35000, 1, 35_000_000),
    (AssetType.DATA_CENTER, 10000, 3, 80_000_000),
    (AssetType.HEALTHCARE, 15000, 8, 60_000_000),
    (AssetType.EDUCATION, 9000, 5, 45_000_000),
    (AssetType.OTHER, 4000, 6, 20_000_000),
]


def _generate_demo_assets(count: int = 95) -> list[dict]:
    """Generate demo buildings for a realistic base (like first batch from OSM/Microsoft)."""
    random.seed(42)
    out = []
    for i in range(count):
        c = random.choice(DEMO_CITIES)
        lat = c["lat_center"] + (random.random() - 0.5) * 2 * c["radius_deg"]
        lon = c["lon_center"] + (random.random() - 0.5) * 2 * c["radius_deg"]
        atype, area, floors, val = random.choice(DEMO_ASSET_TYPES)
        area = int(area * (0.7 + random.random() * 0.6))
        floors = max(1, int(floors * (0.8 + random.random() * 0.4)))
        year = random.randint(1960, 2022)
        out.append({
            "name": f"Building_{c['city'].replace(' ', '_')}_{i + 1}",
            "asset_type": atype,
            "city": c["city"],
            "country_code": c["country_code"],
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "gross_floor_area_m2": area,
            "floors_above_ground": floors,
            "year_built": year,
            "current_valuation": int(val * (0.5 + random.random())),
            "climate_risk_score": random.randint(20, 75),
            "physical_risk_score": random.randint(10, 50),
            "network_risk_score": random.randint(15, 70),
            "description": f"Demo building in {c['city']} for 3D view and stress testing",
        })
    return out


async def seed_sample_assets(db: AsyncSession) -> list[Asset]:
    """
    Seed sample assets for demo/alpha users.
    Creates 5 named assets + ~95 demo buildings (Munich, Berlin, Madrid, NY, etc.) for 3D base.
    Returns list of created assets.
    """
    created_assets = []
    tags_json = json.dumps(["sample", "demo"])

    def _add_asset(asset_data: dict) -> Asset:
        asset_id = str(uuid4())
        city_code = (asset_data["city"] or "XXX")[:3].upper().replace(" ", "_")
        pars_id = f"PARS-EU-{asset_data['country_code']}-{city_code}-{asset_id[:8].upper()}"
        atype = asset_data.get("asset_type")
        if isinstance(atype, AssetType):
            atype = atype.value if hasattr(atype, "value") else str(atype)
        asset = Asset(
            id=asset_id,
            pars_id=pars_id,
            name=asset_data["name"],
            description=asset_data.get("description"),
            asset_type=atype or AssetType.OTHER.value,
            status=AssetStatus.ACTIVE,
            latitude=asset_data.get("latitude"),
            longitude=asset_data.get("longitude"),
            city=asset_data.get("city"),
            country_code=asset_data.get("country_code", "DE"),
            gross_floor_area_m2=asset_data.get("gross_floor_area_m2"),
            floors_above_ground=asset_data.get("floors_above_ground"),
            year_built=asset_data.get("year_built"),
            current_valuation=asset_data.get("current_valuation"),
            valuation_currency="EUR",
            climate_risk_score=asset_data.get("climate_risk_score"),
            physical_risk_score=asset_data.get("physical_risk_score"),
            network_risk_score=asset_data.get("network_risk_score"),
            tags=tags_json,
        )
        db.add(asset)
        created_assets.append(asset)
        return asset

    for asset_data in SAMPLE_ASSETS:
        _add_asset(asset_data)

    for asset_data in _generate_demo_assets(95):
        _add_asset(asset_data)

    await db.commit()
    for asset in created_assets:
        await db.refresh(asset)

    logger.info(f"Seeded {len(created_assets)} sample assets (5 named + demo buildings for 3D)")
    return created_assets


async def seed_digital_twins(db: AsyncSession, assets: list[Asset]) -> list[DigitalTwin]:
    """Create digital twins for assets with sample timeline."""
    twins = []
    
    for asset in assets:
        twin_id = str(uuid4())
        remaining_years = 50 - (2024 - (asset.year_built or 2024))
        twin = DigitalTwin(
            id=twin_id,
            asset_id=str(asset.id),
            state=TwinState.SYNCHRONIZED,
            last_sync_at=datetime.utcnow(),
            sync_source="seed_data",
            geometry_type="ifc",
            structural_integrity=100 - (asset.physical_risk_score or 0),
            condition_score=100 - (asset.physical_risk_score or 0) * 0.8,
            remaining_useful_life_years=max(0.0, float(remaining_years)),
            sensor_data=json.dumps({
                "temperature": 22.5,
                "humidity": 45,
                "occupancy": 0.85,
            }),
            sensor_updated_at=datetime.utcnow(),
            climate_exposures=json.dumps({
                "flood": {"score": 30, "depth_100yr": 0.8},
                "heat": {"score": 40, "cooling_days": 450},
                "wind": {"score": 25, "max_gust": 38},
            }),
            climate_exposures_updated_at=datetime.utcnow(),
            infrastructure_dependencies=json.dumps({
                "power": {"grid_sector": "sector_7", "criticality": 0.9},
                "water": {"district": "district_a", "criticality": 0.6},
            }),
            financial_metrics=json.dumps({
                "pd": 0.018,
                "lgd": 0.32,
                "current_valuation": asset.current_valuation,
            }),
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
                id=str(uuid4()),
                digital_twin_id=twin_id,
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
    """Seed knowledge graph with infrastructure and dependencies. Skipped if Neo4j disabled/unavailable."""
    kg_service = get_knowledge_graph_service()
    if not kg_service.is_available:
        logger.info("Knowledge Graph disabled or unavailable; skipping KG seed")
        return

    try:
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
            atype = getattr(asset.asset_type, "value", asset.asset_type) if asset.asset_type else "other"
            await kg_service.create_asset_node(
                asset_id=asset.id,
                name=asset.name,
                asset_type=atype,
                latitude=float(asset.latitude or 48.0),
                longitude=float(asset.longitude or 11.0),
                valuation=asset.current_valuation,
            )

            # Create dependencies based on location
            if asset.city and "Munich" in asset.city:
                await kg_service.create_dependency(
                    source_id=str(asset.id),
                    target_id="power_grid_sector_7",
                    dependency_type="DEPENDS_ON",
                    criticality=0.9,
                )
            elif asset.city and "Berlin" in asset.city:
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
            if (getattr(asset.asset_type, "value", asset.asset_type) or "") == AssetType.DATA_CENTER.value:
                await kg_service.create_dependency(
                    source_id=str(asset.id),
                    target_id="telecom_hub_central",
                    dependency_type="DEPENDS_ON",
                    criticality=0.95,
                )

        logger.info("Seeded knowledge graph with infrastructure and dependencies")
    except Exception as e:
        logger.warning("Knowledge Graph seed skipped or failed (Neo4j may be down): %s", e)


async def seed_portfolios(db: AsyncSession, assets: list[Asset]) -> int:
    """Seed sample portfolios and link to assets when portfolios table is empty."""
    r = await db.execute(select(func.count()).select_from(Portfolio))
    if (r.scalar() or 0) > 0:
        return 0
    now = datetime.utcnow()
    base = date(2020, 1, 1)
    portfolios_data = [
        {
            "name": "European Core Real Estate Fund",
            "code": "ECREF-001",
            "portfolio_type": PortfolioType.FUND.value,
            "manager_name": "Alpha Capital GmbH",
            "nav": 420_000_000,
            "ffo": 18_500_000,
            "yield_pct": 0.044,
            "debt_to_equity": 0.45,
            "occupancy": 0.92,
            "asset_count": 0,
            "climate_risk_score": 42.0,
        },
        {
            "name": "DACH Logistics REIT",
            "code": "DACH-LOG-1",
            "portfolio_type": PortfolioType.REIT.value,
            "manager_name": "Logistics Partners AG",
            "nav": 185_000_000,
            "ffo": 9_200_000,
            "yield_pct": 0.05,
            "debt_to_equity": 0.55,
            "occupancy": 0.88,
            "asset_count": 0,
            "climate_risk_score": 58.0,
        },
        {
            "name": "Infrastructure Growth Portfolio",
            "code": "IGP-CUSTOM",
            "portfolio_type": PortfolioType.CUSTOM.value,
            "manager_name": "Internal",
            "nav": 95_000_000,
            "ffo": 4_100_000,
            "yield_pct": 0.043,
            "debt_to_equity": 0.35,
            "occupancy": 0.95,
            "asset_count": 0,
            "climate_risk_score": 35.0,
        },
    ]
    created = []
    for i, pdata in enumerate(portfolios_data):
        pid = str(uuid4())
        p = Portfolio(
            id=pid,
            name=pdata["name"],
            code=pdata["code"],
            portfolio_type=pdata["portfolio_type"],
            base_currency="EUR",
            manager_name=pdata["manager_name"],
            nav=pdata["nav"],
            ffo=pdata["ffo"],
            yield_pct=pdata["yield_pct"],
            debt_to_equity=pdata["debt_to_equity"],
            occupancy=pdata["occupancy"],
            asset_count=pdata["asset_count"],
            climate_risk_score=pdata["climate_risk_score"],
            inception_date=base,
            created_at=now,
        )
        db.add(p)
        created.append((pid, pdata["name"]))
    await db.commit()
    # Link first 15 assets to first portfolio
    if created and assets:
        pid0 = created[0][0]
        for j, a in enumerate(assets[:15]):
            pa = PortfolioAsset(
                id=str(uuid4()),
                portfolio_id=pid0,
                asset_id=str(a.id),
                share_pct=100.0 / min(15, len(assets)),
                current_value=a.current_valuation,
                weight_pct=100.0 / min(15, len(assets)),
                created_at=now,
            )
            db.add(pa)
        await db.execute(update(Portfolio).where(Portfolio.id == pid0).values(asset_count=min(15, len(assets))))
        await db.commit()
    logger.info("Seeded %s sample portfolios", len(created))
    return len(created)


async def seed_projects(db: AsyncSession, assets: list[Asset]) -> int:
    """Seed sample projects when projects table is empty."""
    r = await db.execute(select(func.count()).select_from(Project))
    if (r.scalar() or 0) > 0:
        return 0
    now = datetime.utcnow()
    projects_data = [
        {
            "name": "Munich Office Tower Phase 2",
            "code": "MUC-OT-02",
            "project_type": ProjectType.COMMERCIAL.value,
            "status": ProjectStatus.CONSTRUCTION.value,
            "currency": "EUR",
            "total_capex_planned": 45_000_000,
            "irr": 0.092,
            "npv": 5_200_000,
            "overall_completion_pct": 0.65,
            "country_code": "DE",
            "city": "Munich",
            "sponsor_name": "BauInvest GmbH",
        },
        {
            "name": "Berlin Data Center Expansion",
            "code": "BER-DC-01",
            "project_type": ProjectType.UTILITY.value,
            "status": ProjectStatus.DEVELOPMENT.value,
            "currency": "EUR",
            "total_capex_planned": 120_000_000,
            "irr": 0.078,
            "npv": 12_000_000,
            "overall_completion_pct": 0.20,
            "country_code": "DE",
            "city": "Berlin",
            "sponsor_name": "DataCore AG",
        },
        {
            "name": "Hamburg Logistics Hub Upgrade",
            "code": "HAM-LOG-01",
            "project_type": ProjectType.INDUSTRIAL.value,
            "status": ProjectStatus.COMMISSIONING.value,
            "currency": "EUR",
            "total_capex_planned": 28_000_000,
            "irr": 0.105,
            "npv": 3_100_000,
            "overall_completion_pct": 0.88,
            "country_code": "DE",
            "city": "Hamburg",
            "sponsor_name": "Port Logistics GmbH",
        },
    ]
    for i, pdata in enumerate(projects_data):
        pid = str(uuid4())
        primary_asset_id = str(assets[i].id) if i < len(assets) else None
        p = Project(
            id=pid,
            name=pdata["name"],
            code=pdata["code"],
            project_type=pdata["project_type"],
            status=pdata["status"],
            currency=pdata["currency"],
            total_capex_planned=pdata["total_capex_planned"],
            irr=pdata["irr"],
            npv=pdata["npv"],
            overall_completion_pct=pdata["overall_completion_pct"],
            country_code=pdata["country_code"],
            city=pdata["city"],
            sponsor_name=pdata["sponsor_name"],
            primary_asset_id=primary_asset_id,
            created_at=now,
        )
        db.add(p)
    await db.commit()
    logger.info("Seeded %s sample projects", len(projects_data))
    return len(projects_data)


async def seed_fraud_claims(db: AsyncSession, assets: list[Asset]) -> int:
    """Seed sample damage claims when damage_claims table is empty."""
    r = await db.execute(select(func.count()).select_from(DamageClaim))
    if (r.scalar() or 0) > 0:
        return 0
    now = datetime.utcnow()
    claim_num = 1000
    claims_data = [
        {
            "title": "Flood damage to basement and ground floor",
            "claimed_damage_type": DamageType.FLOOD.value,
            "status": ClaimStatus.UNDER_REVIEW.value,
            "claimed_loss_amount": 450_000,
            "assessed_loss_amount": 380_000,
            "fraud_risk_level": FraudRiskLevel.LOW.value,
            "fraud_score": 0.15,
            "claimant_name": "Property Manager GmbH",
        },
        {
            "title": "Storm damage to roof and facade",
            "claimed_damage_type": DamageType.WIND.value,
            "status": ClaimStatus.SUBMITTED.value,
            "claimed_loss_amount": 220_000,
            "assessed_loss_amount": None,
            "fraud_risk_level": FraudRiskLevel.MEDIUM.value,
            "fraud_score": 0.42,
            "claimant_name": "Asset Holder AG",
        },
        {
            "title": "Fire damage to warehouse section",
            "claimed_damage_type": DamageType.FIRE.value,
            "status": ClaimStatus.APPROVED.value,
            "claimed_loss_amount": 1_200_000,
            "assessed_loss_amount": 1_050_000,
            "approved_amount": 1_000_000,
            "fraud_risk_level": FraudRiskLevel.LOW.value,
            "fraud_score": 0.08,
            "claimant_name": "Industrial Real Estate Co",
        },
    ]
    for i, cdata in enumerate(claims_data):
        asset = assets[i % len(assets)] if assets else None
        if not asset:
            continue
        claim_id = str(uuid4())
        claim_num += 1
        c = DamageClaim(
            id=claim_id,
            claim_number=f"CLM-{claim_num}",
            asset_id=str(asset.id),
            claim_type=ClaimType.INSURANCE.value,
            status=cdata["status"],
            title=cdata["title"],
            claimed_damage_type=cdata["claimed_damage_type"],
            claimed_loss_amount=cdata["claimed_loss_amount"],
            assessed_loss_amount=cdata.get("assessed_loss_amount"),
            approved_amount=cdata.get("approved_amount"),
            fraud_risk_level=cdata.get("fraud_risk_level"),
            fraud_score=cdata.get("fraud_score"),
            claimant_name=cdata.get("claimant_name"),
            reported_at=now - timedelta(days=random.randint(1, 30)),
            created_at=now,
        )
        db.add(c)
    await db.commit()
    logger.info("Seeded %s sample damage claims", len(claims_data))
    return len(claims_data)


async def seed_modules_only(db: AsyncSession) -> dict:
    """
    Seed only portfolios, projects, and fraud claims using existing assets.
    Use when assets already exist (e.g. after a full seed) to avoid duplicating assets.
    Returns dict with counts or {"error": "no_assets", "message": "..."} if no assets.
    """
    r = await db.execute(select(Asset).where(Asset.status == AssetStatus.ACTIVE).limit(100))
    assets = list(r.scalars().all())
    if not assets:
        return {"error": "no_assets", "message": "No assets in database. Run full seed first (e.g. Assets page → Load demo data, or POST /api/v1/seed/seed)."}
    portfolios_created = await seed_portfolios(db, assets)
    projects_created = await seed_projects(db, assets)
    claims_created = await seed_fraud_claims(db, assets)
    return {
        "portfolios_created": portfolios_created,
        "projects_created": projects_created,
        "claims_created": claims_created,
        "message": "Portfolios, projects, and fraud claims seeded.",
    }


def _is_missing_table_error(e: Exception) -> bool:
    msg = (str(e) or "").lower()
    return "no such table" in msg or "does not exist" in msg or "relation" in msg and "does not exist" in msg


async def seed_all(db: AsyncSession):
    """
    Seed all sample data for alpha users.
    
    Creates:
    - Sample assets
    - Digital twins with timelines
    - Knowledge graph relationships
    - Sample portfolios, projects, and fraud claims (when tables are empty)
    """
    logger.info("Starting data seeding...")
    warnings: list[str] = []

    # Seed assets
    assets = await seed_sample_assets(db)

    # Seed digital twins
    twins = await seed_digital_twins(db, assets)

    # Seed knowledge graph
    await seed_knowledge_graph(assets)

    # Seed portfolios, projects, fraud claims (only if tables exist and are empty)
    portfolios_created = 0
    projects_created = 0
    claims_created = 0
    try:
        portfolios_created = await seed_portfolios(db, assets)
    except OperationalError as e:
        if _is_missing_table_error(e):
            warnings.append("portfolios: table missing — run on server: cd apps/api && alembic upgrade head")
            logger.warning("Portfolios seed skipped (missing table): %s", e)
        else:
            raise
    try:
        projects_created = await seed_projects(db, assets)
    except OperationalError as e:
        if _is_missing_table_error(e):
            warnings.append("projects: table missing — run on server: cd apps/api && alembic upgrade head")
            logger.warning("Projects seed skipped (missing table): %s", e)
        else:
            raise
    try:
        claims_created = await seed_fraud_claims(db, assets)
    except OperationalError as e:
        if _is_missing_table_error(e):
            warnings.append("fraud_claims: table missing — run on server: cd apps/api && alembic upgrade head")
            logger.warning("Fraud claims seed skipped (missing table): %s", e)
        else:
            raise

    logger.info("Data seeding completed successfully")
    result = {
        "assets_created": len(assets),
        "twins_created": len(twins),
        "infrastructure_nodes": 4,
        "portfolios_created": portfolios_created,
        "projects_created": projects_created,
        "claims_created": claims_created,
        "message": "Demo base loaded. Portfolios, Projects, and Fraud sections now have sample data.",
    }
    if warnings:
        result["warnings"] = warnings
        result["message"] = "Demo base loaded. Some modules skipped (run alembic upgrade head on server): " + "; ".join(warnings)
    return result