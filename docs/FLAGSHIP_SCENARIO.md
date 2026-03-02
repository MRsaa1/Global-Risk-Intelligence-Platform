# Flagship Scenario: Flood + Heat + Infrastructure

This document defines the **flagship product scenario**: combined **flood**, **heat**, and **infrastructure** risk for a single geography (city/region) to demonstrate end-to-end platform capability.

## Objective

One scenario taken to “ideal” quality: a user selects a region, sees flood and heat hazard layers, infrastructure exposure, and gets a single coherent risk view (portfolio impact, stress test, reports) without switching modules.

## Components (already in platform)

| Component | Backend | Frontend / Usage |
|-----------|---------|-------------------|
| **Flood** | `flood_impact_service`, `FloodHydrologyEngine`, climate flood exposure; stress scenarios (e.g. Rhine Valley Flood, Flood Extreme 100y) | Cesium flood layer, Digital Twin flood; stress test type `climate` / flood triggers |
| **Heat** | Climate service heat exposure; stress scenarios (e.g. Heat Stress Energy); `StressTestType.HEAT` | Cesium heat layer; stress test type `heat` |
| **Infrastructure** | CIP models, `infrastructure_job` (ingestion), cascade/impact on critical infrastructure | Infrastructure channel, CIP endpoints, cascade engine |

## Scenario ID: `flagship_flood_heat_infra`

A single combined scenario is available for runbooks and demos:

- **ID:** `flagship_flood_heat_infra`
- **Name:** Flagship: Flood + Heat + Infrastructure
- **Description:** Combined flood and heat stress with infrastructure impact in one geography. Use for product demos and SLO validation.
- **Triggers:** flood, heat; infrastructure exposure from CIP and ingestion.

It is implemented as a **regulatory-style scenario** in the stress scenario registry so it appears in Command Center / stress test flows and can be run with the universal stress engine and cascade.

## How to run the flagship scenario

1. **Command Center:** Select a city or region; ensure flood and heat layers are on; run stress test with scenario **Flagship: Flood + Heat + Infrastructure** (or equivalent combined scenario from the registry).
2. **API:** Create a stress test with `scenario_id` / parameters that map to flood + heat + infrastructure (using existing stress test and cascade endpoints).
3. **Data:** Ensure ingestion has run for `natural_hazards`, `weather`, and `infrastructure` so SLA status is green and Data Sources panel shows recent events.

## Success criteria

- User can select one geography and see flood + heat + infrastructure in one flow.
- Stress test and cascade produce a single report (PDF/Report V2) with flood, heat, and infrastructure impact.
- Data freshness for natural_hazards, weather, infrastructure is visible (Live Data Bar / SLA status) and within SLA.

## References

- Stress scenario registry: `apps/api/src/services/stress_scenario_registry.py` (add or reference `flagship_flood_heat_infra`).
- Stress test seed (flood/heat templates): `apps/api/src/services/stress_test_seed.py`.
- Climate/flood: `apps/api/src/services/climate_service.py`, `flood_impact_service`, `FloodHydrologyEngine`.
- Infrastructure: `apps/api/src/services/ingestion/jobs/infrastructure_job.py`, CIP modules.
- Frontend layers: `CommandCenter.tsx`, `CesiumGlobe.tsx`, `DigitalTwinPanel.tsx` (flood/heat toggles).
