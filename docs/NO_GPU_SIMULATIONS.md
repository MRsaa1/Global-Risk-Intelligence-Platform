# No-GPU Simulations Architecture

This document describes how the platform runs **weather and flood simulations without NVIDIA Earth-2 or GPU**. All components use Open-Meteo (free API), CPU-only flood impact logic, and browser-based 3D (Cesium/Deck.gl).

---

## Overview

| Component | Role | No-GPU implementation |
|-----------|------|------------------------|
| **Weather** | Forecast for stress tests and flood logic | [Open-Meteo API](https://open-meteo.com/) via `climate_data.py` |
| **Flood impact** | Precipitation → flood depth / risk level | `flood_impact_service.py` (CPU rules, no GPU) |
| **Climate / simulations** | Climate stress and hazard assessment | `climate_service.py` uses Open-Meteo when Earth-2 off |
| **Stress tests** | Risk zones, reports, data sources | `risk_zone_calculator`; when NIM off, `data_sources` include "Open-Meteo (API)" |
| **3D visualization** | Flood layer on globe/map | CesiumGlobe and DeckOverlay fetch `/climate/flood-forecast` and draw polygon |

---

## Data flow (no GPU)

```
Open-Meteo API
    → climate_data.get_forecast()
    → flood_impact_service.get_flood_forecast()  [precipitation → depth/risk]
    → Stress tests (risk_zone_calculator) + Climate stress (climate_service)
    → GET /climate/flood-forecast
    → CesiumGlobe / DeckOverlay (flood polygon layer)
```

- **Weather:** `GET /api/v1/climate/forecast`, `GET /api/v1/climate/indicators` (Open-Meteo).
- **Flood forecast:** `GET /api/v1/climate/flood-forecast?latitude=&longitude=&days=7` returns daily precipitation, flood depth (m), risk level, and optional polygon for 3D.
- **Stress tests:** When `USE_LOCAL_NIM` is false or NIM is unavailable, reports list "Open-Meteo (API)" in `data_sources`.
- **Climate service:** When Earth-2 is disabled (`use_earth2=false` or no NVIDIA API key), flood hazard uses Open-Meteo + flood impact (CPU).

---

## Configuration

- **Disable Earth-2 for climate/simulations:** In `apps/api/.env`, set `USE_EARTH2=false` (or omit NVIDIA API key). Flood hazard in climate assessments then uses Open-Meteo + flood impact.
- **Stress tests:** No change required; when NIM is not used, "Open-Meteo (API)" is added to `data_sources` automatically.
- **Flood layer in UI:** Pass `showFloodLayer={true}` and optionally `floodCenter={{ lat, lng }}` to `CesiumGlobe` or `DeckOverlay` to show the flood forecast polygon from the API.

---

## Optional: FloodAdapt (Deltares)

For more advanced flood modeling (e.g. hydraulic models, detailed inundation), [FloodAdapt](https://www.deltares.nl/en/software/floodadapt/) (Deltares) can be used as an external tool. It runs on CPU and does not require GPU. Integration with the platform (e.g. feeding FloodAdapt with Open-Meteo precipitation and importing results for visualization) can be added in a future phase; the current No-GPU stack does not depend on it.

---

## Related docs

- [BREV_DEPLOYMENT.md](BREV_DEPLOYMENT.md) — Deploy without GPU.
- [GPU_SERVER_DIFFERENCES.md](GPU_SERVER_DIFFERENCES.md) — What changes when NIM/GPU is available.
- [E2CC_ON_SERVER_AND_STRESS_TESTS.md](E2CC_ON_SERVER_AND_STRESS_TESTS.md) — Optional E2CC/GPU setup.
