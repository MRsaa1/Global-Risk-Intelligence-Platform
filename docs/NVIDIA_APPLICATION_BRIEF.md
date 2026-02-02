# NVIDIA technology usage — application brief

**Repository:** [https://github.com/MRsaa1/Global-Risk-Intelligence-Platform](https://github.com/MRsaa1/Global-Risk-Intelligence-Platform)

---

## Short description (3 sentences)

**Physical-Financial Risk Platform** is a unified decision centre for physical-financial risks: 3D Digital Twins, stress tests by scenario (flood, fire, wind), cascade analysis, and a Knowledge Graph of dependencies. The platform uses **NVIDIA Cloud API** (Llama 3.1, Mixtral) for generative agents (monitoring, analytics, recommendations, reports) and optionally **NVIDIA NIM** (FourCastNet, CorrDiff) for weather forecasting and climate downscaling. The Command Center shows risk metrics, predictions, and the status of all NVIDIA services (LLM, NIM, Riva, Earth-2, Flux, RAPIDS, NeMo, Dynamo, Triton).

---

## NVIDIA technologies used (full list)

Matches the **NVIDIA Services** block in Command Center and `GET /api/v1/health/nvidia`.

| Product | Role in the application |
|---------|--------------------------|
| **NVIDIA LLM (Cloud API)** | Llama 3.1 70B/8B, Mixtral — agents (SENTINEL, ANALYST, ADVISOR, REPORTER), executive summaries, disclosure drafts, AI-Q chat |
| **NVIDIA AI Orchestration** | Multi-model consensus for stress tests (fast + deep + summary); same API key |
| **Earth-2 FourCastNet NIM** | Weather forecasting (local NIM container, GPU) |
| **Earth-2 CorrDiff NIM** | High-resolution climate downscaling (local NIM) |
| **FLUX.1-dev NIM** | Image generation for REPORTER agent (local or cloud) |
| **NVIDIA Earth-2** | Climate/weather data via `earth2_api_url` |
| **PhysicsNeMo** | Physics-informed simulations: flood, structural, thermal, fire (`physics_nemo_api_url`) |
| **NVIDIA Riva** | TTS/STT for voice alerts and report narration (`enable_riva`, `riva_url`) |
| **NVIDIA Dynamo** | Low-latency distributed inference (optional) |
| **Triton Inference Server** | Model serving, TensorRT-LLM backend (optional) |
| **NeMo Retriever** | RAG pipeline, AI-Q citations |
| **NeMo Guardrails** | Safety and compliance checks for agent output |
| **NeMo Agent Toolkit** | Agent monitoring (Phase 2) |
| **NeMo Curator** | Data curation pipeline |
| **NeMo Data Designer** | Synthetic data generation via NVIDIA Cloud API |
| **NeMo Evaluator** | Agent evaluation (Phase 2) |
| **NVIDIA RAPIDS** (optional) | cuDF, cuGraph, CuPy — accelerated stress tests and graph analytics on GPU |

---

## Innovation: what is unique

- **Single physics–finance layer:** from 3D Digital Twin and climate to PD/LGD and cascade risks — one platform with a verifiable “physics ↔ finance” link.
- **LLM routing:** one service switches between NVIDIA Cloud API, local NIM, Dynamo, and Triton based on configuration; agents work without code changes.
- **Optional GPU stack:** RAPIDS, NIM, Riva — when no GPU is present everything falls back to CPU or cloud; the app keeps working.

---

## Proof of NVIDIA usage (code examples)

### 1. NVIDIA Cloud API — LLM (Llama 3.1, Mixtral)

```python
# apps/api/src/services/nvidia_llm.py
from src.core.config import settings

class NVIDIALLMService:
    def __init__(self):
        self._cloud_base_url = getattr(
            settings, "nvidia_llm_api_url",
            "https://integrate.api.nvidia.com/v1"
        ).rstrip("/")
        self.api_key = settings.nvidia_api_key or ""

    async def generate(self, prompt: str, model: LLMModel = LLMModel.LLAMA_70B, ...):
        base_url, client, model_override = self._get_llm_backend()
        response = await client.post(
            f"{base_url}/chat/completions",
            json={
                "model": model_override or model.value,  # meta/llama-3.1-70b-instruct
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
        )
        data = response.json()
        return LLMResponse(content=choices[0]["message"]["content"], ...)
```

### 2. NVIDIA NIM — FourCastNet & CorrDiff

```python
# apps/api/src/services/nvidia_nim.py
import httpx
import numpy as np
from src.core.config import settings

class NVIDIANIMService:
    def __init__(self):
        self.fourcastnet_url = settings.fourcastnet_nim_url
        self.corrdiff_url = settings.corrdiff_nim_url

    async def fourcastnet_forecast(self, input_time, simulation_length):
        response = await client.post(
            f"{self.fourcastnet_url}/v1/infer",
            json={...},
        )
        # Parse temperature_2m, wind_u_10m, precipitation, etc.
        return FourCastNetForecast(...)

    async def corrdiff_downscale(self, request): ...
```

### 3. NVIDIA RAPIDS (cuDF, cuGraph, CuPy)

```python
# apps/api/src/services/rapids_accelerator.py
try:
    import cudf
    HAS_CUDF = True
except ImportError:
    HAS_CUDF = False
try:
    import cugraph
    HAS_CUGRAPH = True
except ImportError:
    HAS_CUGRAPH = False
try:
    import cupy as cp
    HAS_CUPY = True
except ImportError:
    HAS_CUPY = False

def is_gpu_available() -> bool:
    return HAS_RAPIDS or HAS_CUPY
```

### 4. NVIDIA Riva — TTS / STT

```python
# apps/api/src/services/nvidia_riva.py
class NVIDIARivaService:
    """NVIDIA Riva Speech AI (TTS/STT). Uses gRPC (nvidia-riva-client) or HTTP for NIM Riva."""

    async def tts(self, text: str, language: str = "en") -> Optional[TTSResult]:
        if RIVA_GRPC_AVAILABLE:
            result = await loop.run_in_executor(None, _tts_grpc_sync, text, language)
            return result
        return await self._tts_http(text, language)

    async def _tts_http(self, text: str, language: str):
        r = await client.post(
            url,  # riva_url + /v1/synthesize
            json={"text": text, "model": self.tts_model, "language": language},
        )
        return TTSResult(audio_base64=data["audio_base64"], ...)

    async def stt(self, audio_base64: str, language: str = "en") -> Optional[STTResult]: ...
```

### 5. NVIDIA Earth-2 — weather & climate

```python
# apps/api/src/services/nvidia_earth2.py
class NVIDIAEarth2Service:
    def __init__(self):
        self.api_key = getattr(settings, 'nvidia_api_key', None) or ""
        self.base_url = getattr(settings, 'earth2_api_url', 'https://api.nvidia.com/v1/earth2')

    async def get_weather_forecast(self, lat: float, lon: float, model: Earth2Model = Earth2Model.FOURCASTNET):
        response = await client.post(
            f"{self.base_url}/forecast",
            json={"latitude": lat, "longitude": lon, "model": model.value},
        )
        return WeatherForecast(...)

    async def get_climate_projection(self, lat, lon, scenario: str, time_horizon: int): ...
```

### 6. NVIDIA FLUX — image generation

```python
# apps/api/src/services/nvidia_flux.py
class NVIDIAFluxService:
    def __init__(self):
        self.api_key = getattr(settings, 'nvidia_flux_api_key', None) or ""
        self.nvidia_cloud_url = "https://integrate.api.nvidia.com/v1/genai/black-forest-labs/flux-1-dev"

    async def generate_image(self, prompt: str, width: int = 1024, height: int = 1024, ...):
        response = await self.http_client.post(
            self.nvidia_cloud_url,
            json={"prompt": prompt, "width": width, "height": height, "steps": steps, "seed": seed},
        )
        return GeneratedImage(base64_data=..., prompt=prompt, ...)
```

### 7. PhysicsNeMo — flood / structural simulation

```python
# apps/api/src/services/nvidia_physics_nemo.py
class NVIDIAPhysicsNeMoService:
    def __init__(self):
        self.api_key = getattr(settings, 'nvidia_api_key', None) or ""
        self.base_url = getattr(settings, 'physics_nemo_api_url', 'https://api.nvidia.com/v1/physics-nemo')

    async def simulate_flood(self, geometry, water_level, duration): ...
    async def simulate_structural(self, model: PhysicsModel, payload): ...
```

### 8. NeMo Data Designer — synthetic data (NVIDIA API)

```python
# apps/api/src/services/nemo_data_designer.py
self.api_url = "https://integrate.api.nvidia.com/v1/chat/completions"
self.http_client = httpx.AsyncClient(
    headers={'Authorization': f'Bearer {self.nvidia_api_key}', 'Content-Type': 'application/json'}
)
# generate_stress_test_scenarios() calls NVIDIA Cloud API for synthetic scenario generation
```

---

## Metrics and results

- **Command Center → NVIDIA Services:** status of all 16 services (OK / unavailable / disabled).
- **Health API:** `GET /api/v1/health/nvidia`, `/api/v1/nvidia/riva/health`, `/api/v1/nvidia/dynamo/health`, `/api/v1/nvidia/triton/health`.
- **Stress tests:** run time and per-zone metrics; RAPIDS `rapids_available` when GPU is used.
- **Agents:** UI shows generated text (Summary, recommendations, drafts); source is NVIDIA Cloud API or local NIM.

Full text, tables, and code are in this file; copy from here into application forms as needed.
