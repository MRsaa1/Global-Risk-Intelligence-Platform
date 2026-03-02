"""
Flood Economic Impact Model — FEMA HAZUS depth-damage curves and 5-component loss.

Total Loss = Residential + Commercial + Infrastructure + BusinessInterruption + Emergency.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional

from src.services.flood_hydrology_engine import FloodScenario, FloodModelResult

logger = logging.getLogger(__name__)

# FEMA HAZUS-style depth-damage ratios (depth_m -> damage ratio 0-1)
RESIDENTIAL_DEPTH_DAMAGE = [
    (0.0, 0.0),
    (0.3, 0.08),
    (0.6, 0.18),
    (1.0, 0.32),
    (1.5, 0.45),
    (2.0, 0.58),
    (3.0, 0.72),
    (4.0, 0.85),
]
COMMERCIAL_DEPTH_DAMAGE = [
    (0.0, 0.0),
    (0.3, 0.12),
    (0.6, 0.25),
    (1.0, 0.40),
    (2.0, 0.60),
    (3.0, 0.78),
    (4.0, 0.90),
]
INFRASTRUCTURE_DEPTH_DAMAGE = [
    (0.0, 0.0),
    (0.5, 0.05),
    (1.0, 0.15),
    (2.0, 0.35),
    (3.0, 0.55),
    (4.0, 0.70),
]


def _interp_depth_damage(table: List[tuple], depth_m: float) -> float:
    if depth_m <= 0:
        return 0.0
    for i, (d, r) in enumerate(table):
        if depth_m <= d:
            if i == 0:
                return r
            d0, r0 = table[i - 1]
            t = (depth_m - d0) / (d - d0) if d > d0 else 1.0
            return r0 + t * (r - r0)
    return table[-1][1]


@dataclass
class EconomicImpactPerScenario:
    return_period_years: int
    residential_loss_usd: float
    commercial_loss_usd: float
    infrastructure_loss_usd: float
    business_interruption_usd: float
    emergency_usd: float
    total_loss_usd: float


@dataclass
class FloodEconomicResult:
    city_id: str
    city_name: str
    population: int
    per_scenario: List[EconomicImpactPerScenario]
    ael_usd: float


class FloodEconomicModel:
    """
    Property inventory (per city or default) + HAZUS curves.
    """

    def __init__(
        self,
        median_home_value_usd: float = 250_000,
        residential_units: Optional[int] = None,
        commercial_value_usd: Optional[float] = None,
        infrastructure_value_usd: Optional[float] = None,
    ):
        self.median_home_value_usd = median_home_value_usd
        self.residential_units = residential_units
        self.commercial_value_usd = commercial_value_usd
        self.infrastructure_value_usd = infrastructure_value_usd

    def _inventory_from_population(self, population: int) -> tuple:
        units = self.residential_units
        if units is None:
            units = max(1000, population // 2)
        comm = self.commercial_value_usd
        if comm is None:
            comm = units * self.median_home_value_usd * 0.4
        infra = self.infrastructure_value_usd
        if infra is None:
            infra = units * self.median_home_value_usd * 0.15
        return units, comm, infra

    def compute_loss(
        self,
        scenario: FloodScenario,
        population: int,
        residential_units: Optional[int] = None,
        commercial_value: Optional[float] = None,
        infrastructure_value: Optional[float] = None,
    ) -> EconomicImpactPerScenario:
        units, comm_val, infra_val = self._inventory_from_population(population)
        if residential_units is not None:
            units = residential_units
        if commercial_value is not None:
            comm_val = commercial_value
        if infrastructure_value is not None:
            infra_val = infrastructure_value

        depth = scenario.flood_depth_m
        res_ratio = _interp_depth_damage(RESIDENTIAL_DEPTH_DAMAGE, depth)
        com_ratio = _interp_depth_damage(COMMERCIAL_DEPTH_DAMAGE, depth)
        inf_ratio = _interp_depth_damage(INFRASTRUCTURE_DEPTH_DAMAGE, depth)

        residential_loss = units * self.median_home_value_usd * res_ratio
        commercial_loss = comm_val * com_ratio
        infrastructure_loss = infra_val * inf_ratio
        duration_days = scenario.duration_hours / 24.0
        business_interruption = (commercial_loss * 0.15) * min(3.0, duration_days)
        emergency_per_capita = 50.0 * (1.0 if depth > 0.5 else 0.3)
        emergency_usd = population * emergency_per_capita

        total = (
            residential_loss
            + commercial_loss
            + infrastructure_loss
            + business_interruption
            + emergency_usd
        )
        return EconomicImpactPerScenario(
            return_period_years=scenario.return_period_years,
            residential_loss_usd=round(residential_loss, 0),
            commercial_loss_usd=round(commercial_loss, 0),
            infrastructure_loss_usd=round(infrastructure_loss, 0),
            business_interruption_usd=round(business_interruption, 0),
            emergency_usd=round(emergency_usd, 0),
            total_loss_usd=round(total, 0),
        )

    def run(
        self,
        model_result: FloodModelResult,
    ) -> FloodEconomicResult:
        per_scenario = [
            self.compute_loss(s, model_result.population)
            for s in model_result.scenarios
        ]
        ael = 0.0
        if len(per_scenario) >= 3:
            ael = (
                per_scenario[0].total_loss_usd / 10.0
                + per_scenario[1].total_loss_usd / 50.0
                + per_scenario[2].total_loss_usd / 100.0
            )
        return FloodEconomicResult(
            city_id=model_result.city_id,
            city_name=model_result.city_name,
            population=model_result.population,
            per_scenario=per_scenario,
            ael_usd=round(ael, 0),
        )


flood_economic_model = FloodEconomicModel()
