# Agents: What Works, What Doesn’t, NVIDIA Integration

## Summary

| Agent / Component | Status | Real data? | NVIDIA used |
|-------------------|--------|------------|-------------|
| **SENTINEL** | ✅ Runs | ⚠️ Was simulated → **now real** (DB assets + geodata) | NeMo Agent Toolkit (metrics) |
| **ANALYST** | ✅ API | ✅ RAG (NeMo Retriever), optional LLM | NeMo Retriever, NVIDIA LLM |
| **ADVISOR** | ✅ API | ✅ Options/ROI logic | NeMo Guardrails (optional) |
| **Overseer** | ✅ Runs | ✅ Health + platform layers | NVIDIA LLM (executive summary) |
| **AIQ (Ask)** | ✅ API | ✅ RAG + LLM + guardrails | Retriever, LLM, Guardrails |
| **Monitoring loop** | ✅ Runs | ✅ **Now** real context | — |

---

## 1. What Works

### SENTINEL
- **Rules**: Weather (hurricane, flood), sensor anomalies, infrastructure, climate thresholds, maintenance.
- **Loop**: `_monitoring_loop()` runs on interval; `_build_monitoring_context()` now uses **real DB assets** and **geodata hotspots** (see implementation below).
- **Output**: Alerts broadcast via WebSocket; event_emitter for Recent Activity.
- **Start**: POST `/api/v1/alerts/monitoring/start` (user must start; no auto-start by default).

### ANALYST
- **API**: POST `/api/v1/agents/analyze/alert`, `/analyze/asset`, `/analyze/portfolio`.
- **Pipeline**: NeMo Retriever (KG + historical events) → optional LLM for root cause/correlations.
- **Fallback**: If Retriever/LLM fails, returns structured analysis without RAG.

### ADVISOR
- **API**: POST `/api/v1/agents/recommend/alert`, `/recommend/asset`.
- **Logic**: Options with cost, risk reduction, ROI; optional NeMo Guardrails on outputs.
- **Trigger**: Can be chained after ANALYST (e.g. analyze alert → recommend actions).

### NVIDIA Stack in Use
- **NVIDIA LLM** (`nvidia_llm.py`): Cloud (integrate.api.nvidia.com) or local NIM. Used by Overseer, AIQ, and agents when they call LLM.
- **NeMo Retriever** (`nemo_retriever.py`): KG (Neo4j) + historical_events; optional embeddings/rerank (NVIDIA API). Used by AIQ and ANALYST.
- **NeMo Guardrails** (`nemo_guardrails.py`): Heuristic + configurable checks. Used by AIQ and ADVISOR.
- **NeMo Agent Toolkit** (`nemo_agent_toolkit.py`): Profiling, metrics, workflows. Used by SENTINEL/ANALYST/ADVISOR for latency/success tracking.

---

## 2. What Doesn’t (or Was Weak)

| Issue | Before | Now |
|-------|--------|-----|
| SENTINEL context | Random 5%/3%/2% simulation, fake assets | **Real**: DB assets (climate_risk_score), geodata hotspots (risk &gt; threshold). |
| Monitoring start | Manual only | Still manual (configurable); can add auto-start on first WS connect. |
| ANALYST/ADVISOR in UI | No “Analyze this alert” / “Get recommendations” | Only via API; UI can call these endpoints. |
| End-to-end flow | Alert → no auto ANALYST → ADVISOR | No automatic chain; can add workflow: Alert → ANALYST → ADVISOR. |

---

## 3. NVIDIA Solutions That Actually Help

1. **NVIDIA LLM (cloud or NIM)**  
   - **Use**: Overseer executive summary, AIQ answers, ANALYST/ADVISOR when they need free-form text.  
   - **Config**: `NVIDIA_API_KEY` (cloud) or `LLAMA_NIM_URL` (local).  
   - **Benefit**: One stack for all agent text; no GPU required with cloud.

2. **NeMo Retriever (RAG)**  
   - **Use**: AIQ “ask”, ANALYST “analyze alert/asset” with KG + historical events.  
   - **Benefit**: Answers grounded in platform data; fewer hallucinations.

3. **NeMo Guardrails**  
   - **Use**: Filter/validate AIQ and ADVISOR outputs (compliance, safety).  
   - **Benefit**: Safer, more controlled agent responses.

4. **NeMo Agent Toolkit**  
   - **Use**: SENTINEL/ANALYST/ADVISOR latency, success rate, token/cost (if wired).  
   - **Benefit**: Observability and tuning of agents.

5. **Not yet used (optional)**  
   - **NIM for embeddings/rerank** (Retriever): could move from cloud to local.  
   - **Workflows**: Orchestrate Alert → ANALYST → ADVISOR in one call.  
   - **Riva**: Voice alerts for critical SENTINEL alerts.

---

## 4. High-Impact Fix Implemented: Real SENTINEL Context

**Problem**: SENTINEL was fed random weather/infra and 100 fake assets, so alerts were not tied to real risk.

**Change**: `_build_monitoring_context()` in `alerts.py` now:

1. **Assets from DB**  
   - Loads active assets (limit 500) with `climate_risk_score`, `physical_risk_score`, `network_risk_score`, `current_valuation`.  
   - SENTINEL’s `_check_climate_thresholds(assets)` already alerts when `climate_risk_score > 70` (and similar). So alerts are driven by **real** high-risk assets.

2. **Geodata hotspots**  
   - Calls geo/geodata service (or geodata API) for hotspots with `min_risk` (e.g. 0.6).  
   - If any hotspot has high risk, adds a “Region risk elevated” style entry into `weather_forecast` so SENTINEL can emit geographic risk alerts.

3. **Fallback**  
   - If DB or geodata fails, falls back to previous simulated context so the loop does not crash.

**Result**: With real assets and hotspots, SENTINEL produces alerts that correspond to actual high-risk assets and regions (e.g. “Climate Risk Threshold” for assets with score &gt; 70, and regional alerts where hotspots exceed the threshold).

---

## 5. Recommendations

1. **Keep real SENTINEL context**  
   - Already implemented; ensure DB and geodata are available in production.

2. **Optional: Auto-start monitoring**  
   - When the first client connects to the alerts WebSocket, call `start_monitoring()` so SENTINEL runs without a manual POST.

3. **UI: “Analyze” and “Recommend” on alerts**  
   - In AlertPanel / Command Center: buttons “Analyze” (POST `/agents/analyze/alert`) and “Recommend” (POST `/agents/recommend/alert`) and show results in a drawer/modal.

4. **Workflow: Alert → ANALYST → ADVISOR**  
   - New endpoint or background task: given `alert_id`, run ANALYST then ADVISOR and return analysis + recommendations in one response.

5. **NVIDIA**  
   - Keep using NVIDIA LLM + NeMo Retriever + Guardrails + Agent Toolkit.  
   - Optionally add NIM for local embeddings/rerank and Riva for voice alerts.

---

## 6. Quick Reference: Agent APIs

| Endpoint | Purpose |
|----------|---------|
| POST `/alerts/monitoring/start` | Start SENTINEL loop (real context) |
| POST `/alerts/monitoring/stop` | Stop SENTINEL loop |
| GET `/alerts/` | List alerts (from SENTINEL) |
| POST `/agents/monitor` | One-shot SENTINEL with custom context |
| POST `/agents/analyze/alert` | ANALYST: root cause for alert |
| POST `/agents/analyze/asset` | ANALYST: deep analysis for asset |
| POST `/agents/recommend/alert` | ADVISOR: options for alert |
| POST `/agents/recommend/asset` | ADVISOR: options for asset |
| POST `/aiq/ask` | AIQ: question + RAG + LLM + sources |
| GET `/oversee/status` | Overseer snapshot + optional LLM summary |
