"""
Seed data for Strategic Modules (CIP, SCSS, SRO, ASGI).

Fills each module with 6 entities + relationships for demos.
Uses realistic, generic names and coordinates (European context).
"""
import json
import logging
from datetime import date, datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.cip.service import CIPService
from src.modules.scss.service import SCSSService
from src.modules.sro.service import SROService
from src.modules.srs.service import SRSService

logger = logging.getLogger(__name__)


# ==================== CIP: 6 infrastructure assets ====================
CIP_INFRASTRUCTURE = [
    {
        "name": "Berlin-Mitte Power Transmission Hub",
        "infrastructure_type": "power_transmission",
        "latitude": 52.5200,
        "longitude": 13.4050,
        "criticality_level": "tier_1",
        "country_code": "DE",
        "region": "Berlin",
        "city": "Berlin",
        "description": "Primary 380 kV transmission node for Berlin. National critical.",
        "capacity_value": 1200.0,
        "capacity_unit": "MW",
        "population_served": 3_700_000,
    },
    {
        "name": "Berlin North Distribution Substation",
        "infrastructure_type": "power_distribution",
        "latitude": 52.5620,
        "longitude": 13.3880,
        "criticality_level": "tier_2",
        "country_code": "DE",
        "region": "Berlin",
        "city": "Berlin",
        "description": "110 kV distribution substation serving northern districts.",
        "capacity_value": 250.0,
        "capacity_unit": "MW",
        "population_served": 800_000,
    },
    {
        "name": "Munich South Water Treatment Plant",
        "infrastructure_type": "water_treatment",
        "latitude": 48.1351,
        "longitude": 11.5820,
        "criticality_level": "tier_1",
        "country_code": "DE",
        "region": "Bavaria",
        "city": "Munich",
        "description": "Main drinking water treatment for greater Munich.",
        "capacity_value": 450.0,
        "capacity_unit": "m³/h",
        "population_served": 1_500_000,
    },
    {
        "name": "Frankfurt Financial District Data Center",
        "infrastructure_type": "data_center",
        "latitude": 50.1109,
        "longitude": 8.6821,
        "criticality_level": "tier_1",
        "country_code": "DE",
        "region": "Hesse",
        "city": "Frankfurt",
        "description": "Tier III colocation serving financial sector.",
        "capacity_value": 15.0,
        "capacity_unit": "MW",
        "population_served": 0,
    },
    {
        "name": "Hamburg Port Telecommunications Hub",
        "infrastructure_type": "telecommunications",
        "latitude": 53.5511,
        "longitude": 9.9937,
        "criticality_level": "tier_2",
        "country_code": "DE",
        "region": "Hamburg",
        "city": "Hamburg",
        "description": "Fiber and microwave hub for port and logistics.",
        "capacity_value": 100.0,
        "capacity_unit": "Gbps",
        "population_served": 1_800_000,
    },
    {
        "name": "Stuttgart Regional Emergency Dispatch",
        "infrastructure_type": "emergency_services",
        "latitude": 48.7758,
        "longitude": 9.1829,
        "criticality_level": "tier_1",
        "country_code": "DE",
        "region": "Baden-Württemberg",
        "city": "Stuttgart",
        "description": "Central dispatch for police, fire, ambulance in region.",
        "population_served": 2_800_000,
    },
]

# (source_index, target_index): target depends on source (source is upstream)
CIP_DEPS_LIST = [
    (0, 1),   # Transmission Hub -> North Substation
    (0, 3),   # Transmission Hub -> Data Center (power)
    (4, 3),   # Telecom Hub -> Data Center (connectivity)
    (0, 4),   # Transmission -> Telecom (power for site)
    (4, 5),   # Telecom -> Emergency (dispatch depends on telecom)
]


# ==================== SCSS: 6 suppliers ====================
SCSS_SUPPLIERS = [
    {
        "name": "EuroSteel GmbH",
        "supplier_type": "raw_material",
        "tier": "tier_1",
        "country_code": "DE",
        "region": "North Rhine-Westphalia",
        "city": "Duisburg",
        "description": "Primary steel supplier for automotive and construction.",
        "industry_sector": "metals",
        "is_critical": True,
        "latitude": 51.4344,
        "longitude": 6.7623,
    },
    {
        "name": "Nordic Timber Co AB",
        "supplier_type": "raw_material",
        "tier": "tier_1",
        "country_code": "SE",
        "region": "Västerbotten",
        "city": "Umeå",
        "description": "Sustainable timber and pulp for packaging and construction.",
        "industry_sector": "forestry",
        "is_critical": False,
        "latitude": 63.8258,
        "longitude": 20.2630,
    },
    {
        "name": "Poland Components Sp. z o.o.",
        "supplier_type": "component",
        "tier": "tier_2",
        "country_code": "PL",
        "region": "Silesia",
        "city": "Katowice",
        "description": "Electronics and mechanical components for industrial OEMs.",
        "industry_sector": "electronics",
        "is_critical": True,
        "latitude": 50.2649,
        "longitude": 19.0238,
    },
    {
        "name": "Rotterdam Logistics BV",
        "supplier_type": "logistics",
        "tier": "tier_1",
        "country_code": "NL",
        "region": "South Holland",
        "city": "Rotterdam",
        "description": "Port logistics and inland distribution for EU supply chains.",
        "industry_sector": "logistics",
        "is_critical": True,
        "latitude": 51.9225,
        "longitude": 4.4792,
    },
    {
        "name": "Bavaria Assembly GmbH",
        "supplier_type": "assembly",
        "tier": "tier_1",
        "country_code": "DE",
        "region": "Bavaria",
        "city": "Ingolstadt",
        "description": "Final assembly and kitting for automotive and machinery.",
        "industry_sector": "automotive",
        "is_critical": True,
        "latitude": 48.7651,
        "longitude": 11.4237,
    },
    {
        "name": "Atlantic Cables Ltd",
        "supplier_type": "component",
        "tier": "tier_2",
        "country_code": "IE",
        "region": "Cork",
        "city": "Cork",
        "description": "Specialty cables and connectors for energy and data.",
        "industry_sector": "electronics",
        "is_critical": False,
        "latitude": 51.8985,
        "longitude": -8.4756,
    },
]

# Routes: source_id index -> target_id index (source supplies to target)
SCSS_ROUTES = [
    (0, 2),   # EuroSteel supplies Poland Components (steel for components)
    (1, 2),   # Nordic Timber supplies Poland Components (packaging)
    (2, 4),   # Poland Components supplies Bavaria Assembly
    (3, 0),   # Rotterdam Logistics serves EuroSteel (inbound)
    (3, 4),   # Rotterdam Logistics serves Bavaria Assembly (outbound)
    (5, 2),   # Atlantic Cables supplies Poland Components
    (5, 4),   # Atlantic Cables supplies Bavaria Assembly
]


# ==================== SRO: 6 institutions ====================
SRO_INSTITUTIONS = [
    {
        "name": "EuroBank AG",
        "institution_type": "bank",
        "systemic_importance": "gsib",
        "country_code": "DE",
        "headquarters_city": "Frankfurt",
        "description": "Global systemically important bank, eurozone leader.",
        "total_assets": 1_400_000_000_000,
        "market_cap": 45_000_000_000,
        "regulator": "BaFin",
        "lei_code": "WBWCJ6XYZ1PQHLT8U123",
    },
    {
        "name": "Nordic Insurance Group",
        "institution_type": "insurance",
        "systemic_importance": "gsii",
        "country_code": "SE",
        "headquarters_city": "Stockholm",
        "description": "Major Nordic insurer with pan-European exposure.",
        "total_assets": 280_000_000_000,
        "market_cap": 22_000_000_000,
        "regulator": "EIOPA",
    },
    {
        "name": "Central European Bank",
        "institution_type": "bank",
        "systemic_importance": "dsib",
        "country_code": "PL",
        "headquarters_city": "Warsaw",
        "description": "Domestic systemically important bank, CEE exposure.",
        "total_assets": 120_000_000_000,
        "market_cap": 8_500_000_000,
        "regulator": "KNF",
    },
    {
        "name": "Frankfurt Investment Bank GmbH",
        "institution_type": "investment_bank",
        "systemic_importance": "high",
        "country_code": "DE",
        "headquarters_city": "Frankfurt",
        "description": "Investment banking and capital markets.",
        "total_assets": 95_000_000_000,
        "market_cap": 5_200_000_000,
        "regulator": "BaFin",
    },
    {
        "name": "Benelux Clearing House",
        "institution_type": "clearing_house",
        "systemic_importance": "high",
        "country_code": "NL",
        "headquarters_city": "Amsterdam",
        "description": "CCP for derivatives and securities in Benelux.",
        "total_assets": 50_000_000_000,
        "regulator": "AFM",
    },
    {
        "name": "Dublin Asset Management Ltd",
        "institution_type": "asset_manager",
        "systemic_importance": "medium",
        "country_code": "IE",
        "headquarters_city": "Dublin",
        "description": "Large asset manager with fund and institutional mandates.",
        "total_assets": 320_000_000_000,
        "regulator": "CBI",
    },
]

# Correlations: (index_a, index_b, correlation_coefficient, exposure_amount, contagion_probability)
SRO_CORRELATIONS = [
    (0, 1, 0.45, 2_500_000_000, 0.35),
    (0, 3, 0.72, 8_000_000_000, 0.55),
    (0, 4, 0.38, 1_200_000_000, 0.28),
    (1, 2, 0.22, 400_000_000, 0.18),
    (2, 3, 0.41, 1_800_000_000, 0.32),
    (3, 4, 0.65, 5_000_000_000, 0.48),
    (4, 5, 0.29, 900_000_000, 0.22),
    (0, 2, 0.35, 1_500_000_000, 0.25),
]

# ==================== SRS: sovereign funds + resource deposits ====================
SRS_FUNDS = [
    {"name": "Norwegian Government Pension Fund Global", "country_code": "NO", "description": "Largest sovereign wealth fund.", "total_assets_usd": 1_400_000_000_000, "established_year": 1990},
    {"name": "Abu Dhabi Investment Authority", "country_code": "AE", "description": "Major Middle East sovereign fund.", "total_assets_usd": 853_000_000_000, "established_year": 1976},
    {"name": "China Investment Corporation", "country_code": "CN", "description": "Chinese sovereign wealth fund.", "total_assets_usd": 1_350_000_000_000, "established_year": 2007},
    {"name": "Kuwait Investment Authority", "country_code": "KW", "description": "Oldest sovereign wealth fund.", "total_assets_usd": 700_000_000_000, "established_year": 1953},
    {"name": "Singapore GIC", "country_code": "SG", "description": "Singapore government investment company.", "total_assets_usd": 690_000_000_000, "established_year": 1981},
]

SRS_DEPOSITS = [
    {"name": "North Sea Oil & Gas (Norway)", "resource_type": "oil_gas", "country_code": "NO", "estimated_value_usd": 500_000_000_000, "latitude": 61.0, "longitude": 2.0, "extraction_horizon_years": 25},
    {"name": "Persian Gulf Oil (Kuwait)", "resource_type": "oil_gas", "country_code": "KW", "estimated_value_usd": 400_000_000_000, "latitude": 29.0, "longitude": 48.0, "extraction_horizon_years": 50},
    {"name": "Rare Earth Minerals (China)", "resource_type": "minerals", "country_code": "CN", "estimated_value_usd": 200_000_000_000, "latitude": 35.0, "longitude": 105.0, "extraction_horizon_years": 30},
    {"name": "UAE Oil Reserves", "resource_type": "oil_gas", "country_code": "AE", "estimated_value_usd": 350_000_000_000, "latitude": 24.0, "longitude": 54.0, "extraction_horizon_years": 40},
    {"name": "Southeast Asia Natural Gas", "resource_type": "gas", "country_code": "SG", "estimated_value_usd": 80_000_000_000, "latitude": 1.3, "longitude": 103.8, "extraction_horizon_years": 20},
]


# SRO indicators (market and institution-level) for dashboard
SRO_INDICATORS = [
    {"indicator_type": "contagion", "indicator_name": "Systemic Contagion Index", "value": 42.0, "scope": "market", "warning_threshold": 60.0, "critical_threshold": 80.0},
    {"indicator_type": "concentration", "indicator_name": "Banking Sector HHI", "value": 0.18, "scope": "market", "warning_threshold": 0.25, "critical_threshold": 0.35},
    {"indicator_type": "liquidity", "indicator_name": "Aggregate Liquidity Ratio", "value": 1.35, "scope": "market", "warning_threshold": 1.0, "critical_threshold": 0.8},
    {"indicator_type": "volatility", "indicator_name": "Market Volatility (VIX-style)", "value": 18.5, "scope": "market", "warning_threshold": 25.0, "critical_threshold": 35.0},
    {"indicator_type": "interconnectedness", "indicator_name": "Network Density", "value": 0.52, "scope": "market", "warning_threshold": 0.7, "critical_threshold": 0.85},
    {"indicator_type": "correlation", "indicator_name": "Cross-Institution Correlation", "value": 0.48, "scope": "market", "warning_threshold": 0.65, "critical_threshold": 0.8},
]


async def seed_cip(db: AsyncSession) -> dict:
    """Seed CIP with 6 infrastructure assets and dependencies."""
    from src.modules.cip.models import CriticalInfrastructure
    service = CIPService(db)
    count_result = await db.execute(select(func.count()).select_from(CriticalInfrastructure))
    n = count_result.scalar() or 0
    if n >= 6:
        logger.info("CIP already has infrastructure; skipping CIP seed")
        return {"cip_infrastructure": 0, "cip_dependencies": 0, "cip_skipped": True}

    ids = []
    for item in CIP_INFRASTRUCTURE:
        infra = await service.register_infrastructure(
            name=item["name"],
            infrastructure_type=item["infrastructure_type"],
            latitude=item["latitude"],
            longitude=item["longitude"],
            criticality_level=item["criticality_level"],
            country_code=item["country_code"],
            region=item.get("region"),
            city=item.get("city"),
            description=item.get("description"),
            capacity_value=item.get("capacity_value"),
            capacity_unit=item.get("capacity_unit"),
            population_served=item.get("population_served"),
        )
        ids.append(infra.id)

    deps_added = 0
    for i_src, i_tgt in CIP_DEPS_LIST:
        if i_src < len(ids) and i_tgt < len(ids):
            await service.add_dependency(
                source_id=ids[i_src],
                target_id=ids[i_tgt],
                dependency_type="operational",
                strength=0.9,
                description=f"Dependency from {CIP_INFRASTRUCTURE[i_src]['name']} to {CIP_INFRASTRUCTURE[i_tgt]['name']}",
            )
            deps_added += 1

    await db.commit()
    logger.info("CIP seeded: %s infrastructure, %s dependencies", len(ids), deps_added)
    return {"cip_infrastructure": len(ids), "cip_dependencies": deps_added}


async def seed_scss(db: AsyncSession) -> dict:
    """Seed SCSS with 6 suppliers and supply routes."""
    from src.modules.scss.models import Supplier
    service = SCSSService(db)
    count_result = await db.execute(select(func.count()).select_from(Supplier))
    n = count_result.scalar() or 0
    if n >= 6:
        logger.info("SCSS already has suppliers; skipping SCSS seed")
        return {"scss_suppliers": 0, "scss_routes": 0, "scss_skipped": True}

    ids = []
    for item in SCSS_SUPPLIERS:
        supplier = await service.register_supplier(
            name=item["name"],
            supplier_type=item["supplier_type"],
            tier=item["tier"],
            country_code=item["country_code"],
            region=item.get("region"),
            city=item.get("city"),
            description=item.get("description"),
            industry_sector=item.get("industry_sector"),
            is_critical=item.get("is_critical", False),
            latitude=item.get("latitude"),
            longitude=item.get("longitude"),
        )
        ids.append(supplier.id)

    routes_added = 0
    for i_src, i_tgt in SCSS_ROUTES:
        if i_src < len(ids) and i_tgt < len(ids):
            await service.add_route(
                source_id=ids[i_src],
                target_id=ids[i_tgt],
                target_type="supplier",
                transport_mode="road",
                transit_time_days=2,
                is_primary=True,
                description=f"Supply route: {SCSS_SUPPLIERS[i_src]['name']} -> {SCSS_SUPPLIERS[i_tgt]['name']}",
            )
            routes_added += 1

    await db.commit()
    logger.info("SCSS seeded: %s suppliers, %s routes", len(ids), routes_added)
    return {"scss_suppliers": len(ids), "scss_routes": routes_added}


async def seed_sro(db: AsyncSession) -> dict:
    """Seed SRO with 6 institutions, correlations, and indicators."""
    from src.modules.sro.models import FinancialInstitution
    service = SROService(db)
    count_result = await db.execute(select(func.count()).select_from(FinancialInstitution))
    n = count_result.scalar() or 0
    if n >= 6:
        logger.info("SRO already has institutions; skipping SRO seed")
        result = {"sro_institutions": 0, "sro_correlations": 0, "sro_indicators": 0, "sro_skipped": True}
    else:
        ids = []
        for item in SRO_INSTITUTIONS:
            inst = await service.register_institution(
                name=item["name"],
                institution_type=item["institution_type"],
                systemic_importance=item["systemic_importance"],
                country_code=item["country_code"],
                headquarters_city=item.get("headquarters_city"),
                description=item.get("description"),
                total_assets=item.get("total_assets"),
                market_cap=item.get("market_cap"),
                regulator=item.get("regulator"),
                lei_code=item.get("lei_code"),
            )
            ids.append(inst.id)

        corr_added = 0
        for i_a, i_b, coeff, exposure, contagion in SRO_CORRELATIONS:
            if i_a < len(ids) and i_b < len(ids) and i_a != i_b:
                await service.add_correlation(
                    institution_a_id=ids[i_a],
                    institution_b_id=ids[i_b],
                    correlation_coefficient=coeff,
                    relationship_type="counterparty",
                    exposure_amount=exposure,
                    contagion_probability=contagion,
                    description=f"Exposure/correlation {SRO_INSTITUTIONS[i_a]['name']} <-> {SRO_INSTITUTIONS[i_b]['name']}",
                )
                corr_added += 1

        ind_added = 0
        for ind in SRO_INDICATORS:
            await service.record_indicator(
                indicator_type=ind["indicator_type"],
                indicator_name=ind["indicator_name"],
                value=ind["value"],
                scope=ind["scope"],
                warning_threshold=ind.get("warning_threshold"),
                critical_threshold=ind.get("critical_threshold"),
                data_source="strategic_modules_seed",
            )
            ind_added += 1

        await db.commit()
        logger.info("SRO seeded: %s institutions, %s correlations, %s indicators", len(ids), corr_added, ind_added)
        result = {"sro_institutions": len(ids), "sro_correlations": corr_added, "sro_indicators": ind_added}

    return result


async def seed_srs(db: AsyncSession) -> dict:
    """Seed SRS with demo sovereign funds and resource deposits. Idempotent: skip if already populated."""
    from src.modules.srs.models import SovereignFund, ResourceDeposit
    service = SRSService(db)
    fund_count = await db.execute(select(func.count()).select_from(SovereignFund))
    dep_count = await db.execute(select(func.count()).select_from(ResourceDeposit))
    n_funds = fund_count.scalar() or 0
    n_deps = dep_count.scalar() or 0
    if n_funds >= 3 and n_deps >= 3:
        logger.info("SRS already has funds and deposits; skipping SRS seed")
        return {"srs_funds": 0, "srs_deposits": 0, "srs_skipped": True}

    fund_ids = []
    if n_funds < 3:
        for item in SRS_FUNDS:
            fund = await service.create_fund(
                name=item["name"],
                country_code=item["country_code"],
                description=item.get("description"),
                total_assets_usd=item.get("total_assets_usd"),
                established_year=item.get("established_year"),
            )
            fund_ids.append(fund.id)

    deposits_added = 0
    if n_deps < 3:
        for i, item in enumerate(SRS_DEPOSITS):
            sovereign_fund_id = fund_ids[i % len(fund_ids)] if fund_ids else None
            await service.create_deposit(
                name=item["name"],
                resource_type=item["resource_type"],
                country_code=item["country_code"],
                sovereign_fund_id=sovereign_fund_id,
                estimated_value_usd=item.get("estimated_value_usd"),
                latitude=item.get("latitude"),
                longitude=item.get("longitude"),
                extraction_horizon_years=item.get("extraction_horizon_years"),
            )
            deposits_added += 1

    await db.commit()
    logger.info("SRS seeded: %s funds, %s deposits", len(fund_ids), deposits_added)
    return {"srs_funds": len(fund_ids), "srs_deposits": deposits_added}


ASGI_DEMO_SYSTEMS = [
    {"name": "Qwen2.5-32B (Planning)", "version": "2.5", "system_type": "llm", "capability_level": "general"},
    {"name": "Nemotron-4 (Auditor)", "version": "4.0", "system_type": "llm", "capability_level": "general"},
]

ASGI_DEMO_CAPABILITY_EVENTS = [
    {"event_type": "benchmark_jump", "metrics": {"benchmark_jump": 0.12, "task_expansion": 0.05}},
    {"event_type": "novel_capability", "metrics": {"novel_tool_combo": 2, "reasoning_depth": 1.5}},
]

ASGI_DEMO_DRIFT_SNAPSHOTS = [
    {"drift_from_baseline": 0.05, "constraint_set": {"constraints": ["max_steps_10", "tool_whitelist"]}},
    {"drift_from_baseline": 0.12, "constraint_set": {"constraints": ["max_steps_10", "tool_whitelist", "no_execute"]}},
]


async def seed_asgi(db: AsyncSession) -> dict:
    """Seed ASGI Phase 3: compliance frameworks, demo AI systems, capability events, drift snapshots."""
    from src.modules.asgi.compliance import COMPLIANCE_FRAMEWORKS_SEED
    from src.modules.asgi.models import AISystem, CapabilityEvent, ComplianceFramework, GoalDriftSnapshot

    result = {"asgi_compliance_frameworks": 0, "asgi_systems": 0, "asgi_capability_events": 0, "asgi_drift_snapshots": 0}

    # Compliance frameworks
    count_result = await db.execute(select(func.count()).select_from(ComplianceFramework))
    n = count_result.scalar() or 0
    if n < 3:
        for item in COMPLIANCE_FRAMEWORKS_SEED:
            existing = await db.execute(
                select(ComplianceFramework).where(ComplianceFramework.framework_code == item["framework_code"])
            )
            if existing.scalar_one_or_none():
                continue
            fw = ComplianceFramework(
                framework_code=item["framework_code"],
                name=item["name"],
                jurisdiction=item["jurisdiction"],
                requirements=json.dumps(item.get("requirements", {})),
                mapping_to_asgi=json.dumps(item.get("mapping_to_asgi", {})),
                effective_date=date.today(),
                last_updated=datetime.utcnow(),
            )
            db.add(fw)
        result["asgi_compliance_frameworks"] = len(COMPLIANCE_FRAMEWORKS_SEED)

    # Demo AI systems
    sys_count = await db.execute(select(func.count()).select_from(AISystem))
    if (sys_count.scalar() or 0) < 2:
        system_ids = []
        for item in ASGI_DEMO_SYSTEMS:
            sys = AISystem(
                name=item["name"],
                version=item["version"],
                system_type=item["system_type"],
                capability_level=item["capability_level"],
                created_at=datetime.utcnow(),
            )
            db.add(sys)
            await db.flush()
            system_ids.append(sys.id)
        result["asgi_systems"] = len(system_ids)

        # Capability events for first system
        if system_ids:
            for ev in ASGI_DEMO_CAPABILITY_EVENTS:
                ce = CapabilityEvent(
                    ai_system_id=system_ids[0],
                    event_type=ev["event_type"],
                    metrics=json.dumps(ev["metrics"]),
                    severity=3,
                    created_at=datetime.utcnow(),
                )
                db.add(ce)
            result["asgi_capability_events"] = len(ASGI_DEMO_CAPABILITY_EVENTS)

            # Drift snapshots for first system
            for snap in ASGI_DEMO_DRIFT_SNAPSHOTS:
                gds = GoalDriftSnapshot(
                    ai_system_id=system_ids[0],
                    snapshot_date=date.today(),
                    constraint_set=json.dumps(snap.get("constraint_set", {})),
                    drift_from_baseline=snap.get("drift_from_baseline"),
                    created_at=datetime.utcnow(),
                )
                db.add(gds)
            result["asgi_drift_snapshots"] = len(ASGI_DEMO_DRIFT_SNAPSHOTS)

    await db.commit()
    logger.info(
        "ASGI seeded: compliance=%s systems=%s events=%s snapshots=%s",
        result["asgi_compliance_frameworks"],
        result["asgi_systems"],
        result["asgi_capability_events"],
        result["asgi_drift_snapshots"],
    )
    return result


async def seed_strategic_modules(db: AsyncSession) -> dict:
    """
    Seed strategic modules (CIP, SCSS, SRO, SRS, ASGI) with demo entities.
    Idempotent: skips a module if it already has enough entities.
    """
    cip_result = await seed_cip(db)
    scss_result = await seed_scss(db)
    sro_result = await seed_sro(db)
    srs_result = await seed_srs(db)
    asgi_result = await seed_asgi(db)

    return {
        "message": "Strategic modules seeded (CIP, SCSS, SRO, SRS, ASGI).",
        **cip_result,
        **scss_result,
        **sro_result,
        **srs_result,
        **asgi_result,
    }
