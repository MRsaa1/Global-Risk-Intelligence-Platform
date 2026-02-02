# NVIDIA Integration Guide

## Overview

Physical-Financial Risk Platform integrates with NVIDIA's AI and simulation stack for high-accuracy climate and physics modeling.

---

## 🔥 MUST USE Products

### 1. NVIDIA Earth-2

**Purpose:** Climate simulations and weather forecasting

**Integration:**
- High-resolution climate projections (CMIP6 downscaling)
- Weather forecasting (FourCastNet, CorrDiff)
- Historical climate data

**API Endpoints:**
- `POST /api/v1/earth2/forecast` - Weather forecast
- `POST /api/v1/earth2/climate/project` - Climate projection
- `POST /api/v1/earth2/historical` - Historical data

**Configuration:**
```python
# .env
NVIDIA_API_KEY=your_api_key_here
EARTH2_API_URL=https://api.nvidia.com/v1/earth2
```

**Usage:**
```python
from src.services.nvidia_earth2 import earth2_service

# Get weather forecast
forecast = await earth2_service.get_weather_forecast(
    latitude=48.1351,
    longitude=11.5820,
    forecast_hours=72,
)

# Get climate projection
projection = await earth2_service.get_climate_projection(
    latitude=48.1351,
    longitude=11.5820,
    scenario="ssp245",
    time_horizon=2050,
)
```

**Benefits:**
- ✅ 10x higher resolution than standard CMIP6
- ✅ Real-time weather forecasting
- ✅ Physics-informed downscaling
- ✅ Industry-leading accuracy

---

### 2. NVIDIA PhysicsNeMo

**Purpose:** Physics-informed AI for simulations

**Integration:**
- Flood hydrodynamics
- Structural analysis (earthquake, wind)
- Thermal dynamics
- Fire spread modeling

**API Endpoints:**
- `POST /api/v1/physics-nemo/simulate/flood` - Flood simulation
- `POST /api/v1/physics-nemo/simulate/structural` - Structural analysis
- `POST /api/v1/physics-nemo/simulate/wind` - Wind loading
- `POST /api/v1/physics-nemo/simulate/thermal` - Thermal dynamics

**Configuration:**
```python
# .env
NVIDIA_API_KEY=your_api_key_here
PHYSICS_NEMO_API_URL=https://api.nvidia.com/v1/physics-nemo
```

**Usage:**
```python
from src.services.nvidia_physics_nemo import physics_nemo_service

# Simulate flood
result = await physics_nemo_service.simulate_flood(
    geometry=bim_geometry,
    flood_input={
        "depth_m": 1.5,
        "velocity_ms": 0.8,
        "duration_hours": 48,
    },
    building_properties={
        "type": "commercial_office",
        "basement_present": True,
    },
)
```

**Benefits:**
- ✅ Physics-informed neural networks
- ✅ 100x faster than traditional CFD
- ✅ High accuracy (validated against experiments)
- ✅ Handles complex geometries

---

### 3. NVIDIA Inception

**Purpose:** Free GPU credits for startups

**Status:** ✅ **Team is in NVIDIA Inception** — credits and access available.

**Next steps with Inception:**
1. Enable credits in `.env`: `NVIDIA_INCEPTION_ENABLED=true`
2. Add API key(s) from NVIDIA Developer Portal (Inception benefits)
3. Use credits for Earth-2, PhysicsNeMo, NIM, and LLM API calls
4. Optionally run local NIM (FourCastNet, CorrDiff) on GPU server and set `USE_LOCAL_NIM=true` to reduce cloud cost

**Benefits:**
- ✅ Free credits for early-stage startups
- ✅ Access to NVIDIA's AI infrastructure
- ✅ Technical support
- ✅ Marketing opportunities

**Configuration:**
```python
# .env
NVIDIA_INCEPTION_ENABLED=true
NVIDIA_INCEPTION_CREDITS=10000  # Credits allocated (adjust per your allocation)
NVIDIA_API_KEY=...              # From NVIDIA Developer Portal / Inception
```

---

## 🎯 Integration Status

| Product | Status | Priority | Integration Level |
|---------|--------|----------|-------------------|
| Earth-2 | ✅ Integrated | ⭐⭐⭐ Critical | Full API integration |
| PhysicsNeMo | ✅ Integrated | ⭐⭐⭐ Critical | Full API integration |
| Inception | ✅ In Program | ⭐⭐⭐ Critical | Configuration ready; use credits for APIs |

---

## Usage in Platform

### Climate Service

The `ClimateService` automatically uses Earth-2 when API key is available:

```python
# Automatically uses Earth-2 if configured
assessment = await climate_service.get_climate_assessment(
    latitude=48.1351,
    longitude=11.5820,
    scenario=ClimateScenario.SSP245,
    time_horizon=2050,
    use_earth2=True,  # Default: True
)
```

### Physics Engine

The `PhysicsEngine` automatically uses PhysicsNeMo when available:

```python
# Automatically uses PhysicsNeMo if configured
result = await physics_engine.simulate_flood(
    asset_id="...",
    flood_depth_m=1.5,
    use_physics_nemo=True,  # Default: True
    geometry=bim_geometry,  # Required for PhysicsNeMo
)
```

---

## Fallback Behavior

Both services gracefully fall back to simplified models if:
- API key not configured
- API unavailable
- Rate limit exceeded
- Network error

This ensures the platform always works, even without NVIDIA services.

---

## Cost Estimation

**Earth-2:**
- Weather forecast: ~$0.01 per request
- Climate projection: ~$0.05 per request
- Historical data: ~$0.02 per request

**PhysicsNeMo:**
- Flood simulation: ~$0.10 per simulation
- Structural analysis: ~$0.15 per simulation
- Thermal: ~$0.08 per simulation

**Monthly Estimate (1000 assets, daily updates):**
- Earth-2: ~$500/month
- PhysicsNeMo: ~$300/month
- **Total: ~$800/month**

With NVIDIA Inception credits, first $10K is free.

---

---

## 🔮 Future Integrations

### ORBIT-2 (Oak Ridge / NVIDIA)

**Paper:** [arXiv:2505.04802](https://arxiv.org/abs/2505.04802)

**What it is:**
- Exascale Vision Foundation Model for Weather and Climate Downscaling
- 10 billion parameters across 65,536 GPUs
- Achieves 4.1 exaFLOPS sustained throughput
- R² scores 0.98-0.99 against observational data
- Supports downscaling to 0.9 km global resolution

**Key Innovations:**
1. **Residual Slim ViT (Reslim)** - Lightweight architecture with Bayesian regularization
2. **TILES** - Tile-wise sequence scaling (quadratic → linear complexity)

**Why it matters for us:**
- Ultra-high resolution climate risk at asset level
- Process sequences up to 4.2 billion tokens
- Real-time regional decision-making

**Integration Plan:**
```python
# Future: ORBIT-2 integration via Earth-2 API
projection = await earth2_service.get_hyper_resolution_climate(
    latitude=48.1351,
    longitude=11.5820,
    resolution_km=0.9,  # ORBIT-2 capability
    model="orbit-2",
)
```

**Status:** 🔄 Planned (awaiting API availability)

---

### Digital Twin for Tsunami Early Warning

**Paper:** SC25 Gordon Bell Prize Winner

**What it is:**
- First physics-based probabilistic tsunami digital twin
- 10 billion-fold speedup (50 years → 0.2 seconds)
- Real-time sensor data + full-physics modeling

**Why it matters for us:**
- Template for real-time physical risk digital twins
- Coastal asset protection
- Emergency response integration

**Status:** 🔄 Research monitoring

---

### ICON Earth System Model

**What it is:**
- Kilometer-scale global climate simulation
- 146 days simulated per 24 hours
- Runs on JUPITER (Europe's first exascale supercomputer)

**Why it matters for us:**
- Highest resolution Earth system data available
- Local-scale climate projections
- Full Earth system (atmosphere + ocean + land)

**Status:** 🔄 Data integration planned

---

## Next Steps (with Inception)

1. ~~**Apply for NVIDIA Inception**~~ — ✅ Already in program
2. **Get API Key** — From NVIDIA Developer Portal (Inception benefits)
3. **Configure** — Set `NVIDIA_INCEPTION_ENABLED=true` and `NVIDIA_API_KEY` in `.env`
4. **Test** — Run Earth-2 / NIM / LLM; stress tests and climate layers will use credits
5. **Monitor** — Track usage and credits; consider local NIM for high-volume workloads

---

**Version:** 0.2.0  
**Last Updated:** 2026-01-13
