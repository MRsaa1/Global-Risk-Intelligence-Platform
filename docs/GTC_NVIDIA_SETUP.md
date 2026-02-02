# GTC (GPU Technology Conference) — NVIDIA Riva, Dynamo, Triton Setup

This guide gets **NVIDIA Riva** (voice alerts, TTS for reports), **Dynamo** (low-latency inference), and **Triton Inference Server** (self-hosted LLM) working with the Physical-Financial Risk Platform for demos and competitions.

---

## 1. NVIDIA Riva (Speech AI)

**Purpose:** Voice alerts (SENTINEL), TTS for stress test reports, optional voice interface.

### Option A: Docker (GTC profile)

```bash
# Start Riva (and Triton) with GPU
docker compose -f docker-compose.nvidia.yml --profile gtc up -d riva
```

Riva listens on **port 50051** (gRPC). First-time setup may require downloading models via [NGC Riva Quick Start](https://catalog.ngc.nvidia.com/orgs/nvidia/teams/riva/resources/riva_quickstart) (`riva_init.sh`, `riva_start.sh`).

### Option B: NGC Riva Quick Start scripts

1. Download [Riva Quick Start](https://catalog.ngc.nvidia.com/orgs/nvidia/teams/riva/resources/riva_quickstart).
2. Set `NGC_API_KEY` in `config.sh`.
3. Run `bash riva_init.sh` (download models), then `bash riva_start.sh`.
4. Server listens on `0.0.0.0:50051`.

### API configuration

In `apps/api/.env`:

```env
ENABLE_RIVA=true
RIVA_URL=http://localhost:50051
```

For remote Riva: `RIVA_URL=http://<host>:50051` (gRPC uses host:port; strip `http://` is done automatically for gRPC).

### Python client (recommended for production TTS/STT)

Install the Riva gRPC client so the API uses native gRPC (faster and reliable):

```bash
cd apps/api
pip install ".[nvidia]"
# or: pip install nvidia-riva-client
```

Without it, the API falls back to HTTP (if your Riva deployment exposes REST). With `nvidia-riva-client`, TTS/STT use gRPC to `RIVA_URL` (host:port).

### Verify

- **Health:** `GET http://localhost:9002/api/v1/nvidia/riva/health` → `{"enabled": true, "reachable": true}`.
- **TTS:** `POST /api/v1/nvidia/riva/tts` with `{"text": "Hello", "language": "en"}` → `audio_base64`, `sample_rate_hz`, `format`.
- **UI:** "Read aloud" in alerts and stress test report uses Riva when enabled; otherwise browser Web Speech API.

---

## 2. NVIDIA Dynamo (Low-latency inference)

**Purpose:** Distributed, low-latency LLM inference when scaling agents.

### Deployment

Deploy per [NVIDIA Dynamo documentation](https://docs.nvidia.com/dynamo/):

- Use `dynamo build --containerize` to build a container, or
- Use NGC [Dynamo vLLM Runtime](https://catalog.ngc.nvidia.com/orgs/nvidia/teams/ai-dynamo/containers/vllm-runtime) / Helm charts as needed.

Expose an **OpenAI-compatible** endpoint (e.g. `/v1/chat/completions`) on the port you use (e.g. **8004**).

### API configuration

In `apps/api/.env`:

```env
ENABLE_DYNAMO=true
DYNAMO_URL=http://localhost:8004
```

When both Dynamo and Triton are enabled, the LLM service uses **Dynamo first**, then Triton, then Cloud/NIM.

### Verify

- **Health:** `GET http://localhost:9002/api/v1/nvidia/dynamo/health` → `{"enabled": true, "reachable": true}`.
- **Status:** `GET /api/v1/health/nvidia` → `dynamo.ready: true` when reachable.

---

## 3. Triton Inference Server (LLM / TensorRT-LLM)

**Purpose:** Self-hosted LLM/embeddings (e.g. TensorRT-LLM backend).

### Docker (GTC profile)

```bash
docker compose -f docker-compose.nvidia.yml --profile gtc up -d triton
```

Triton listens on **8000** (HTTP), **8001** (gRPC), **8002** (metrics). For LLM you typically add a model repository (TensorRT-LLM or OpenAI-compatible frontend); see [Triton LLM docs](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/client_guide/openai_readme.html).

### API configuration

In `apps/api/.env`:

```env
ENABLE_TRITON=true
TRITON_URL=http://localhost:8000
TRITON_LLM_MODEL=nemotron
```

Use `TRITON_LLM_MODEL` as the model name sent to Triton (e.g. your loaded model name).

### Verify

- **Health:** `GET http://localhost:9002/api/v1/nvidia/triton/health` → `{"enabled": true, "reachable": true}`.
- Triton readiness: `GET http://localhost:8000/v2/health/ready` (200 when ready).

---

## 4. All-in-one (GTC)

1. **Start Riva + Triton** (if using compose):

   ```bash
   docker compose -f docker-compose.nvidia.yml --profile gtc up -d riva triton
   ```

2. **Configure API** (`apps/api/.env`):

   ```env
   ENABLE_RIVA=true
   RIVA_URL=http://localhost:50051

   # Optional: when Dynamo is deployed
   # ENABLE_DYNAMO=true
   # DYNAMO_URL=http://localhost:8004

   ENABLE_TRITON=true
   TRITON_URL=http://localhost:8000
   TRITON_LLM_MODEL=nemotron
   ```

3. **Install Riva client** (for gRPC TTS/STT):

   ```bash
   cd apps/api && pip install ".[nvidia]"
   ```

4. **Start API:**

   ```bash
   uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
   ```

5. **Check status:** `GET http://localhost:9002/api/v1/health/nvidia` — `riva`, `dynamo`, `triton` show `configured` and `ready` when reachable.

---

## 5. Endpoints summary

| Service | Config | Health endpoint | Calls |
|--------|--------|------------------|--------|
| **Riva** | `ENABLE_RIVA`, `RIVA_URL` | `GET /api/v1/nvidia/riva/health` | `POST /riva/tts`, `POST /riva/stt` |
| **Dynamo** | `ENABLE_DYNAMO`, `DYNAMO_URL` | `GET /api/v1/nvidia/dynamo/health` | LLM routing when enabled |
| **Triton** | `ENABLE_TRITON`, `TRITON_URL` | `GET /api/v1/nvidia/triton/health` | LLM routing when enabled |

All three are **disabled by default**. Set the corresponding `ENABLE_*` and URL in `.env` and ensure the service is running so the platform uses them without further code changes.
