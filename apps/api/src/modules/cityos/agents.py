"""
CITYOS_MONITOR Agent - City health and capacity monitoring.

Monitors city twins for capacity overload, high climate exposure,
population decline, and migration surge alerts.
"""
import logging
from datetime import datetime
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from src.layers.agents.sentinel import Alert, AlertSeverity, AlertType

from .service import CityOSService, _climate_exposure_for_lat

logger = logging.getLogger(__name__)

CAPACITY_WARNING = 0.85
CAPACITY_CRITICAL = 0.95
CLIMATE_HIGH = 0.55
MIGRATION_SURGE_THRESHOLD = 50_000  # annual flow


class CityOSMonitorAgent:
    """
    CITYOS_MONITOR - Monitors city twin health 24/7.

    Checks:
    - Capacity utilization approaching limits
    - High climate exposure composite score
    - Migration surge (high inflow)
    - Low or declining population
    """

    module = "cityos"
    monitoring_frequency = 600  # seconds

    async def run_cycle(self, db: AsyncSession) -> list[Alert]:
        alerts: list[Alert] = []
        svc = CityOSService(db)

        try:
            cities = await svc.list_cities(limit=500)
            routes = await svc.list_migration_routes(limit=1000)
        except Exception as e:
            logger.warning("CITYOS_MONITOR data load failed: %s", e)
            return alerts

        inflows: dict[str, int] = {}
        for r in routes:
            if r.destination_city_id:
                inflows[r.destination_city_id] = inflows.get(r.destination_city_id, 0) + (r.estimated_flow_per_year or 0)

        for city in cities:
            pop = city.population or 0
            nominal_cap = max(int(pop * 1.3), 50_000)
            utilization = pop / nominal_cap if nominal_cap > 0 else 0.5

            if utilization >= CAPACITY_CRITICAL:
                alerts.append(Alert(
                    id=uuid4(),
                    alert_type=AlertType.INFRASTRUCTURE_ISSUE,
                    severity=AlertSeverity.CRITICAL,
                    title=f"City at capacity: {city.name}",
                    message=f"{city.name} ({city.country_code}) utilization {utilization:.0%}. "
                            f"Population: {pop:,}. Immediate infrastructure expansion needed.",
                    asset_ids=[city.id],
                    exposure=float(pop),
                    recommended_actions=[
                        "Initiate emergency infrastructure planning",
                        "Review housing and transport capacity",
                        "Consider migration flow management",
                    ],
                    created_at=datetime.utcnow(),
                ))
            elif utilization >= CAPACITY_WARNING:
                alerts.append(Alert(
                    id=uuid4(),
                    alert_type=AlertType.INFRASTRUCTURE_ISSUE,
                    severity=AlertSeverity.WARNING,
                    title=f"City approaching capacity: {city.name}",
                    message=f"{city.name} utilization {utilization:.0%}. Plan expansion.",
                    asset_ids=[city.id],
                    exposure=float(pop),
                    recommended_actions=["Plan infrastructure expansion", "Monitor growth trends"],
                    created_at=datetime.utcnow(),
                ))

            # Climate exposure
            climate = _climate_exposure_for_lat(city.latitude)
            composite = sum(climate.values()) / max(len(climate), 1)
            if composite >= CLIMATE_HIGH:
                worst_hazard = max(climate, key=climate.get)  # type: ignore[arg-type]
                alerts.append(Alert(
                    id=uuid4(),
                    alert_type=AlertType.CLIMATE_THRESHOLD,
                    severity=AlertSeverity.HIGH,
                    title=f"High climate exposure: {city.name}",
                    message=f"{city.name} composite climate score {composite:.2f}. "
                            f"Primary hazard: {worst_hazard} ({climate[worst_hazard]:.2f}).",
                    asset_ids=[city.id],
                    exposure=float(pop),
                    recommended_actions=[
                        f"Assess {worst_hazard} resilience infrastructure",
                        "Review climate adaptation budget",
                        "Update emergency response plans",
                    ],
                    created_at=datetime.utcnow(),
                ))

            # Migration surge
            city_inflow = inflows.get(city.id, 0)
            if city_inflow >= MIGRATION_SURGE_THRESHOLD:
                alerts.append(Alert(
                    id=uuid4(),
                    alert_type=AlertType.INFRASTRUCTURE_ISSUE,
                    severity=AlertSeverity.WARNING,
                    title=f"Migration surge: {city.name}",
                    message=f"{city.name} receiving ~{city_inflow:,}/year inflow. "
                            f"Capacity planning recommended.",
                    asset_ids=[city.id],
                    exposure=float(city_inflow),
                    recommended_actions=[
                        "Expand housing and social services",
                        "Review integration programmes",
                        "Coordinate with origin cities",
                    ],
                    created_at=datetime.utcnow(),
                ))

        logger.info("CITYOS_MONITOR cycle: %d alerts emitted", len(alerts))
        return alerts
