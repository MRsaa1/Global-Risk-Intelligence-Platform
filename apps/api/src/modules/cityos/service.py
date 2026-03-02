"""CityOS module service layer.

City Operating System: capacity forecasting, climate exposure scoring,
population growth projections, infrastructure load, migration analytics,
and municipal budget impact modelling.
"""
import logging
import math
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import CityTwin, MigrationRoute

logger = logging.getLogger(__name__)

# Infrastructure category weights for capacity score
INFRA_WEIGHTS = {
    "housing": 0.25,
    "transport": 0.20,
    "water": 0.15,
    "energy": 0.15,
    "healthcare": 0.15,
    "education": 0.10,
}

# Climate hazard base scores by latitude band (simplified)
LATITUDE_CLIMATE_RISK = [
    ((-90, -60), {"flood": 0.1, "heat": 0.0, "storm": 0.3, "drought": 0.0}),
    ((-60, -30), {"flood": 0.3, "heat": 0.2, "storm": 0.3, "drought": 0.2}),
    ((-30, 0), {"flood": 0.5, "heat": 0.6, "storm": 0.5, "drought": 0.4}),
    ((0, 30), {"flood": 0.5, "heat": 0.7, "storm": 0.5, "drought": 0.5}),
    ((30, 60), {"flood": 0.4, "heat": 0.3, "storm": 0.4, "drought": 0.3}),
    ((60, 90), {"flood": 0.2, "heat": 0.0, "storm": 0.2, "drought": 0.1}),
]


def _climate_exposure_for_lat(lat: Optional[float]) -> Dict[str, float]:
    if lat is None:
        return {"flood": 0.3, "heat": 0.3, "storm": 0.3, "drought": 0.3}
    for (lo, hi), scores in LATITUDE_CLIMATE_RISK:
        if lo <= lat < hi:
            return dict(scores)
    return {"flood": 0.3, "heat": 0.3, "storm": 0.3, "drought": 0.3}


class CityOSService:
    """Service for City Operating System operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.module_namespace = "cityos"

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    async def list_cities(
        self,
        country_code: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[CityTwin]:
        q = select(CityTwin).order_by(CityTwin.name)
        if country_code:
            q = q.where(CityTwin.country_code == country_code.upper())
        q = q.limit(limit).offset(offset)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def create_city(
        self,
        name: str,
        country_code: str,
        region: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        population: Optional[int] = None,
        description: Optional[str] = None,
        capacity_notes: Optional[str] = None,
    ) -> CityTwin:
        cityos_id = f"CITYOS-CITY-{country_code.upper()}-{str(uuid4())[:8].upper()}"
        city = CityTwin(
            id=str(uuid4()),
            cityos_id=cityos_id,
            name=name,
            country_code=country_code.upper()[:2],
            region=region,
            latitude=latitude,
            longitude=longitude,
            population=population,
            description=description,
            capacity_notes=capacity_notes,
        )
        self.db.add(city)
        await self.db.flush()
        return city

    async def get_city(self, city_id: str) -> Optional[CityTwin]:
        result = await self.db.execute(
            select(CityTwin).where(
                (CityTwin.id == city_id) | (CityTwin.cityos_id == city_id)
            )
        )
        return result.scalar_one_or_none()

    async def update_city(self, city_id: str, **kwargs: Any) -> Optional[CityTwin]:
        city = await self.get_city(city_id)
        if not city:
            return None
        allowed = {"name", "region", "latitude", "longitude", "population", "description", "capacity_notes"}
        for k, v in kwargs.items():
            if k in allowed and v is not None:
                setattr(city, k, v)
        city.updated_at = datetime.utcnow()
        await self.db.flush()
        return city

    async def delete_city(self, city_id: str) -> bool:
        city = await self.get_city(city_id)
        if not city:
            return False
        await self.db.delete(city)
        await self.db.flush()
        return True

    async def list_migration_routes(
        self,
        origin_city_id: Optional[str] = None,
        destination_city_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[MigrationRoute]:
        q = select(MigrationRoute).order_by(MigrationRoute.name)
        if origin_city_id:
            q = q.where(MigrationRoute.origin_city_id == origin_city_id)
        if destination_city_id:
            q = q.where(MigrationRoute.destination_city_id == destination_city_id)
        q = q.limit(limit).offset(offset)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def create_migration_route(
        self,
        name: str,
        origin_city_id: Optional[str] = None,
        destination_city_id: Optional[str] = None,
        estimated_flow_per_year: Optional[int] = None,
        driver_type: Optional[str] = None,
        description: Optional[str] = None,
    ) -> MigrationRoute:
        cityos_id = f"CITYOS-ROUTE-{str(uuid4())[:8].upper()}"
        route = MigrationRoute(
            id=str(uuid4()),
            cityos_id=cityos_id,
            name=name,
            origin_city_id=origin_city_id,
            destination_city_id=destination_city_id,
            estimated_flow_per_year=estimated_flow_per_year,
            driver_type=driver_type,
            description=description,
        )
        self.db.add(route)
        await self.db.flush()
        return route

    # ------------------------------------------------------------------
    # Forecasting
    # ------------------------------------------------------------------

    async def get_forecast(
        self,
        city_id: Optional[str] = None,
        scenario: str = "capacity_planning",
        horizon_years: int = 5,
        growth_rate: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Forecast city capacity with population growth, migration, and infrastructure load."""
        cities = await self.list_cities(limit=500)
        routes = await self.list_migration_routes(limit=500)

        if city_id:
            city = await self.get_city(city_id)
            if not city:
                return {"city_id": city_id, "scenario": scenario, "status": "error",
                        "forecast": {"message": "City not found."}, "run_at": datetime.utcnow().isoformat()}

            return self._forecast_single_city(city, routes, scenario, horizon_years, growth_rate)

        return self._forecast_aggregate(cities, routes, scenario, horizon_years, growth_rate)

    def _forecast_single_city(
        self, city: CityTwin, routes: List[MigrationRoute],
        scenario: str, horizon_years: int, growth_rate: Optional[float],
    ) -> Dict[str, Any]:
        population = city.population or 100_000
        annual_growth = growth_rate if growth_rate is not None else self._estimate_growth_rate(population)
        inflow = sum(r.estimated_flow_per_year or 0 for r in routes if r.destination_city_id == city.id)
        outflow = sum(r.estimated_flow_per_year or 0 for r in routes if r.origin_city_id == city.id)
        net_migration = inflow - outflow

        # Project population year by year
        pop_path = [population]
        for y in range(1, horizon_years + 1):
            new_pop = int(pop_path[-1] * (1 + annual_growth) + net_migration)
            pop_path.append(max(0, new_pop))

        terminal_pop = pop_path[-1]
        nominal_capacity = self._nominal_capacity(population)
        capacity_utilization = min(1.0, max(0.0, terminal_pop / nominal_capacity)) if nominal_capacity else 0.5

        # Infrastructure load by category
        infra_load = {}
        for cat, weight in INFRA_WEIGHTS.items():
            load = min(1.0, (terminal_pop / nominal_capacity) * weight / max(weight, 0.01))
            infra_load[cat] = round(load, 3)

        # Climate exposure
        climate = _climate_exposure_for_lat(city.latitude)
        climate_composite = round(sum(climate.values()) / max(len(climate), 1), 3)

        # Budget impact (per-capita cost model)
        per_capita_cost_eur = 8500  # average European municipality
        budget_baseline = population * per_capita_cost_eur
        budget_terminal = terminal_pop * per_capita_cost_eur * (1 + climate_composite * 0.1)  # climate premium

        return {
            "city_id": city.id,
            "city_name": city.name,
            "scenario": scenario,
            "status": "completed",
            "forecast": {
                "capacity_utilization": round(capacity_utilization, 3),
                "population_current": population,
                "population_terminal": terminal_pop,
                "population_path": pop_path,
                "annual_growth_rate": round(annual_growth, 4),
                "migration_net_annual": net_migration,
                "migration_inflow": inflow,
                "migration_outflow": outflow,
                "nominal_capacity": nominal_capacity,
                "infrastructure_load": infra_load,
                "climate_exposure": climate,
                "climate_composite_score": climate_composite,
                "budget_baseline_eur": round(budget_baseline, 0),
                "budget_terminal_eur": round(budget_terminal, 0),
                "budget_change_pct": round((budget_terminal / max(budget_baseline, 1) - 1) * 100, 2),
                "horizon_years": horizon_years,
            },
            "run_at": datetime.utcnow().isoformat(),
        }

    def _forecast_aggregate(
        self, cities: List[CityTwin], routes: List[MigrationRoute],
        scenario: str, horizon_years: int, growth_rate: Optional[float],
    ) -> Dict[str, Any]:
        total_pop = sum(c.population or 0 for c in cities)
        total_flow = sum(r.estimated_flow_per_year or 0 for r in routes)
        annual_growth = growth_rate if growth_rate is not None else 0.012
        terminal_pop = int(total_pop * (1 + annual_growth) ** horizon_years + total_flow * horizon_years)
        nominal_capacity = self._nominal_capacity(total_pop)
        capacity_utilization = min(1.0, terminal_pop / max(nominal_capacity, 1))

        cities_at_risk = []
        for c in cities:
            pop = c.population or 0
            nc = self._nominal_capacity(pop)
            if nc > 0 and pop / nc > 0.85:
                cities_at_risk.append({"name": c.name, "utilization": round(pop / nc, 2), "population": pop})

        return {
            "city_id": None,
            "scenario": scenario,
            "status": "completed",
            "forecast": {
                "capacity_utilization": round(capacity_utilization, 3),
                "total_population_current": total_pop,
                "total_population_terminal": terminal_pop,
                "annual_growth_rate": round(annual_growth, 4),
                "total_migration_flow": total_flow,
                "cities_count": len(cities),
                "routes_count": len(routes),
                "cities_at_capacity_risk": cities_at_risk[:10],
                "horizon_years": horizon_years,
            },
            "run_at": datetime.utcnow().isoformat(),
        }

    def _estimate_growth_rate(self, population: int) -> float:
        """Heuristic growth rate based on city size (smaller cities grow faster)."""
        if population < 100_000:
            return 0.018
        if population < 500_000:
            return 0.014
        if population < 2_000_000:
            return 0.010
        return 0.007

    def _nominal_capacity(self, population: int) -> int:
        """Estimate infrastructure capacity (approx 1.3x current population for developed cities)."""
        return max(int(population * 1.3), 50_000)

    # ------------------------------------------------------------------
    # Climate exposure
    # ------------------------------------------------------------------

    async def get_climate_exposure(self, city_id: str) -> Dict[str, Any]:
        """Climate exposure scoring for a city based on its geographic position."""
        city = await self.get_city(city_id)
        if not city:
            return {"error": "City not found", "city_id": city_id}
        hazards = _climate_exposure_for_lat(city.latitude)
        composite = round(sum(hazards.values()) / max(len(hazards), 1), 3)
        risk_level = "low" if composite < 0.25 else "medium" if composite < 0.5 else "high" if composite < 0.75 else "critical"
        return {
            "city_id": city.id,
            "city_name": city.name,
            "latitude": city.latitude,
            "longitude": city.longitude,
            "hazards": hazards,
            "composite_score": composite,
            "risk_level": risk_level,
        }

    # ------------------------------------------------------------------
    # Migration analytics
    # ------------------------------------------------------------------

    async def get_migration_analytics(self) -> Dict[str, Any]:
        """Migration flow analytics across all cities."""
        cities = await self.list_cities(limit=500)
        routes = await self.list_migration_routes(limit=1000)
        city_map = {c.id: c.name for c in cities}

        inflows: Dict[str, int] = {}
        outflows: Dict[str, int] = {}
        driver_counts: Dict[str, int] = {}

        for r in routes:
            flow = r.estimated_flow_per_year or 0
            if r.destination_city_id:
                inflows[r.destination_city_id] = inflows.get(r.destination_city_id, 0) + flow
            if r.origin_city_id:
                outflows[r.origin_city_id] = outflows.get(r.origin_city_id, 0) + flow
            dt = r.driver_type or "unknown"
            driver_counts[dt] = driver_counts.get(dt, 0) + 1

        top_destinations = sorted(inflows.items(), key=lambda x: -x[1])[:10]
        top_origins = sorted(outflows.items(), key=lambda x: -x[1])[:10]

        return {
            "total_routes": len(routes),
            "total_flow": sum(r.estimated_flow_per_year or 0 for r in routes),
            "top_destinations": [{"city_id": cid, "city_name": city_map.get(cid, cid), "inflow": v} for cid, v in top_destinations],
            "top_origins": [{"city_id": cid, "city_name": city_map.get(cid, cid), "outflow": v} for cid, v in top_origins],
            "driver_distribution": driver_counts,
            "sankey_data": [
                {
                    "source": city_map.get(r.origin_city_id or "", r.origin_city_id or "?"),
                    "target": city_map.get(r.destination_city_id or "", r.destination_city_id or "?"),
                    "value": r.estimated_flow_per_year or 0,
                    "driver": r.driver_type,
                }
                for r in routes if (r.estimated_flow_per_year or 0) > 0
            ][:50],
        }

    # ------------------------------------------------------------------
    # Dashboard overview
    # ------------------------------------------------------------------

    async def get_dashboard(self) -> Dict[str, Any]:
        """Aggregate dashboard data for the CityOS module."""
        cities = await self.list_cities(limit=500)
        routes = await self.list_migration_routes(limit=500)
        total_pop = sum(c.population or 0 for c in cities)
        countries = list({c.country_code for c in cities})

        climate_risks = []
        for c in cities:
            exp = _climate_exposure_for_lat(c.latitude)
            composite = sum(exp.values()) / max(len(exp), 1)
            climate_risks.append({"city": c.name, "score": round(composite, 2), "lat": c.latitude, "lng": c.longitude, "population": c.population or 0})

        climate_risks.sort(key=lambda x: -x["score"])

        return {
            "cities_count": len(cities),
            "routes_count": len(routes),
            "total_population": total_pop,
            "countries": countries,
            "total_migration_flow": sum(r.estimated_flow_per_year or 0 for r in routes),
            "top_climate_risk_cities": climate_risks[:10],
            "cities_by_population": sorted(
                [{"name": c.name, "population": c.population or 0, "country": c.country_code} for c in cities],
                key=lambda x: -x["population"],
            )[:15],
        }
