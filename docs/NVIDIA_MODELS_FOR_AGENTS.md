# NVIDIA Models for PFRP Agents

## Overview

Each autonomous agent in PFRP uses specific NVIDIA models optimized for their tasks.

---

## Agent → Model Mapping

### SENTINEL Agent (Monitoring & Early Warning)

**Purpose**: 24/7 monitoring, anomaly detection, early warning

| Task | Model | Why |
|------|-------|-----|
| Weather forecasting | **FourCastNet** | 6-hour resolution, 10-day forecast |
| Climate anomalies | **CorrDiff** | High-resolution downscaling |
| Extreme event detection | **Earth-2** | CMIP6 scenarios |

**NIM Endpoint**: `http://localhost:8001` (FourCastNet)

```python
# Example: SENTINEL weather monitoring
from services.nvidia_nim import nim_service

forecasts = await nim_service.fourcastnet_forecast(
    input_data=weather_data,
    input_time=datetime.now(),
    simulation_length=40,  # 10 days (40 x 6 hours)
)

# Check for extreme events
for forecast in forecasts:
    if forecast.precipitation[lat, lon] > 50:  # mm/6hr
        trigger_flood_alert(asset_id)
```

---

### ANALYST Agent (Deep Analysis)

**Purpose**: Root cause analysis, simulation, risk assessment

| Task | Model | Why |
|------|-------|-----|
| Flood simulation | **PhysicsNeMo** | Physics-informed AI |
| Structural analysis | **PhysicsNeMo** | Earthquake, wind response |
| Climate projections | **CorrDiff** | High-resolution scenarios |
| Report interpretation | **Llama 3.1 70B** | Text understanding |

**NIM Endpoints**: 
- PhysicsNeMo: Cloud API
- Llama: `http://localhost:8003`

```python
# Example: ANALYST flood analysis
from services.nvidia_physics_nemo import physics_nemo_service

result = await physics_nemo_service.simulate_flood(
    geometry=bim_geometry,
    flood_input={"depth_m": 2.5, "velocity_ms": 1.2},
    building_properties={"type": "commercial_office"},
)

damage_assessment = f"Expected damage: {result.damage_ratio * 100:.1f}%"
```

---

### ADVISOR Agent (Recommendations)

**Purpose**: Investment recommendations, ROI analysis, optimization

| Task | Model | Why |
|------|-------|-----|
| Risk summarization | **Llama 3.1 70B** | Best reasoning |
| Option evaluation | **Mixtral 8x22B** | Fast, multi-expert |
| Natural language | **Llama 3.1** | Conversation |

**Recommended Models** (from build.nvidia.com):
- `meta/llama-3.1-70b-instruct` - Best for complex reasoning
- `mistralai/mixtral-8x22b-instruct-v0.1` - Fast multi-task
- `meta/llama-3.1-8b-instruct` - Lightweight, fast

```python
# Example: ADVISOR recommendation
prompt = f"""
Asset: {asset.name}
Climate Risk Score: {asset.climate_risk_score}/100
Flood Simulation Result: {flood_result.damage_ratio * 100:.1f}% damage

Recommend mitigation measures with ROI analysis.
"""

response = await llm_service.generate(
    model="meta/llama-3.1-70b-instruct",
    prompt=prompt,
    max_tokens=2000,
)
```

---

### REPORTER Agent (Report Generation)

**Purpose**: Automated report generation, visualizations, compliance

| Task | Model | Why |
|------|-------|-----|
| Report writing | **Llama 3.1 70B** | Professional text |
| Executive summaries | **Llama 3.1 8B** | Fast, concise |
| Visualization generation | **FLUX.1-dev** | Report illustrations |
| Chart descriptions | **Llama 3.1** | Alt text, captions |

**NIM Endpoint**: `http://localhost:8002` (FLUX)

```python
# Example: REPORTER visualization
from services.nvidia_flux import flux_service

# Generate building damage illustration for report
image = await flux_service.generate_image(
    prompt="3D architectural rendering of commercial building with flood damage, water level at 2 meters, professional technical illustration",
    mode="base",
    steps=50,
)

# Save to report
report.add_image(image, caption="Simulated flood damage scenario")
```

---

## Full Model List

### Climate & Physics (Earth-2)

| Model | Use Case | GPU Memory | Speed |
|-------|----------|------------|-------|
| FourCastNet | Weather forecast | 8GB | Fast |
| CorrDiff | Climate downscaling | 16GB | Medium |
| PhysicsNeMo | Physics simulations | 24GB+ | Slow |

### Language Models

| Model | Use Case | GPU Memory | Quality |
|-------|----------|------------|---------|
| Llama 3.1 8B | Fast responses | 16GB | Good |
| Llama 3.1 70B | Complex reasoning | 80GB+ | Best |
| Mixtral 8x22B | Multi-task | 48GB | Great |

### Image Generation

| Model | Use Case | GPU Memory | Quality |
|-------|----------|------------|---------|
| FLUX.1-dev | Report illustrations | 24GB | Excellent |
| FLUX.1-Canny | Edge-guided | 24GB | Excellent |
| FLUX.1-Depth | Depth-aware | 24GB | Excellent |

---

## Deployment Options

### Option 1: Local NIM (Best Performance)

```bash
# Start all NIMs
./scripts/start-nvidia-nim.sh
```

Requires:
- NVIDIA GPU (24GB+ VRAM recommended)
- Docker with NVIDIA runtime
- NGC API key

### Option 2: NVIDIA Cloud API (No GPU needed)

```python
# Uses NVIDIA API endpoints
# Requires NVIDIA_API_KEY in environment
```

### Option 3: Hybrid (Recommended)

- **Local**: FourCastNet (lightweight, real-time monitoring)
- **Cloud**: Llama 70B (heavy, occasional use)
- **Cloud**: PhysicsNeMo (heavy simulations)

---

## API Keys Required

| Service | Key Variable | Get From |
|---------|--------------|----------|
| NGC | `NGC_API_KEY` | ngc.nvidia.com |
| FourCastNet | `NVIDIA_FOURCASTNET_API_KEY` | build.nvidia.com |
| CorrDiff | `NVIDIA_CORRDIFF_API_KEY` | build.nvidia.com |
| FLUX | `NVIDIA_FLUX_API_KEY` | build.nvidia.com |
| Hugging Face | `HF_TOKEN` | huggingface.co |
| Llama | `NVIDIA_API_KEY` | build.nvidia.com |

---

## Quick Start

```bash
# 1. Set up environment
cp .env.nvidia .env

# 2. Add your Hugging Face token (for FLUX)
echo "HF_TOKEN=hf_your_token_here" >> .env

# 3. Start local NIMs (if GPU available)
./scripts/start-nvidia-nim.sh

# 4. Or use cloud APIs (no GPU)
# Just set NVIDIA_API_KEY and use cloud endpoints
```
