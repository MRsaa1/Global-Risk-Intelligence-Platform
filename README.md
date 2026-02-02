# 🌍 PHYSICAL-FINANCIAL RISK PLATFORM

## The Operating System for the Physical Economy

This repository is the **Physical-Financial Risk Platform**: a unified decision centre for physical-financial risks. After starting the stack, open **Command Center** — the main platform interface:

**→ [http://127.0.0.1:5180/command](http://127.0.0.1:5180/command)**

There you get: 3D globe with risk zones, stress tests by scenario, Digital Twins, Cascade Analysis, metric and prediction panels, event timeline, agent integration and System Overseer, **Generative AI** (zone/scenario explanations, recommendations, disclosure drafts, AI-Q chat), and **Read aloud** for alerts and reports (browser voice — no server needed).

---

## 🎯 Vision

> **Every change in physical reality MUST be reflected in the financial model. And vice versa. In real time. Automatically. Verifiably.**

The platform combines **3D Digital Twins** with **climate simulations**, **financial models**, and **dependency networks** — creating a continuous, verifiable link between physical reality and financial decisions.

**Product model (6 directions: 3D + AI in fintech):** risk assessment for physical assets, lending/insurance for complex objects, REIT/portfolios, fraud detection, project finance, immersive analytics. — [docs/PRODUCT_MODEL_3D_FINTECH.md](docs/PRODUCT_MODEL_3D_FINTECH.md)

---

## 🏗️ Architecture: Five Layers of Reality

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LAYER 5: PROTOCOL (PARS)                      │
│         Open standard for physical-financial data exchange           │
└─────────────────────────────────────────────────────────────────────┘
                                    ↑
┌─────────────────────────────────────────────────────────────────────┐
│                     LAYER 4: AUTONOMOUS AGENTS                       │
│          AI agents: monitoring, prediction, recommendation           │
└─────────────────────────────────────────────────────────────────────┘
                                    ↑
┌─────────────────────────────────────────────────────────────────────┐
│                   LAYER 3: SIMULATION ENGINE                         │
│        Physics + Climate + Economics + Cascade propagation           │
└─────────────────────────────────────────────────────────────────────┘
                                    ↑
┌─────────────────────────────────────────────────────────────────────┐
│                   LAYER 2: NETWORK INTELLIGENCE                      │
│          Knowledge Graph of dependencies and relationships           │
└─────────────────────────────────────────────────────────────────────┘
                                    ↑
┌─────────────────────────────────────────────────────────────────────┐
│                 LAYER 1: LIVING DIGITAL TWINS                        │
│            3D models with complete temporal history                  │
└─────────────────────────────────────────────────────────────────────┘
                                    ↑
┌─────────────────────────────────────────────────────────────────────┐
│                    LAYER 0: VERIFIED TRUTH                           │
│           Cryptographic proofs of physical state                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Capabilities

### Layer 0: Verified Truth
- Cryptographically signed data provenance
- Immutable audit trail
- Court-admissible digital evidence

### Layer 1: Living Digital Twins
- 3D BIM model ingestion (IFC format)
- Complete temporal history (past → present → futures)
- Real-time IoT integration
- Geometry, condition, exposures, financials

### Layer 2: Network Intelligence
- Knowledge Graph (Neo4j)
- Hidden dependency discovery
- Cascade risk modeling
- Infrastructure interconnections

### Layer 3: Simulation Engine
- **Physics Engine**: Flood, structural, thermal, fire
- **Climate Engine**: CMIP6 scenarios, acute/chronic hazards
- **Economics Engine**: PD, LGD, climate-adjusted DCF
- **Cascade Engine**: Monte Carlo propagation

### Layer 4: Autonomous Agents
- **SENTINEL:** 24/7 monitoring, anomaly detection, automated alerts; LLM explanations for alerts (Summary in Analyze & Recommend modal)
- **ANALYST:** Deep dive, root cause analysis
- **ADVISOR:** Recommendations, ROI evaluation
- **REPORTER:** Automated report generation
- **SYSTEM OVERSEER:** System-wide health monitoring, automatic issue resolution, circuit breaker management
- **Generative AI:** Executive summaries, zone and scenario explanations, text recommendations, disclosure drafts (EBA/Fed/NGFS), “Ask about risks” chat (AI-Q), source synthesis (API)

### Layer 5: Protocol (PARS)
- Physical Asset Risk Schema
- Industry standard (future ISO)
- Interoperability across systems

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript, Three.js/R3F, Deck.gl, CesiumJS, TailwindCSS, Vite |
| **Backend** | Python FastAPI, Celery + Redis, GraphQL, WebSockets |
| **3D/BIM** | IFC.js, IfcOpenShell, Open3D, CesiumJS (3D Globe) |
| **Database** | PostgreSQL + PostGIS, TimescaleDB, Neo4j, Redis, MinIO |
| **AI/ML** | PyTorch, PyG, **NVIDIA Cloud API** (Llama 3.1 — используется при заданном `NVIDIA_API_KEY`), AI-Q (RAG + citations), Generative AI endpoints. Опционально: local NIM, Dynamo/Triton (только Linux+NVIDIA GPU) |
| **Speech** | **Web Speech API** (браузер) для «Read aloud» — работает без сервера. Опционально: NVIDIA Riva (только Linux+NVIDIA GPU; образы NIM — платная подписка) |
| **Climate** | CMIP6, FEMA, NOAA, Copernicus, NVIDIA Earth-2 |
| **Resilience** | Circuit Breakers, Retry with Backoff, Fallback Mechanisms |
| **Infrastructure** | Docker, Kubernetes, Auto-restart scripts |

---

## 📁 Project Structure

```
/physical-financial-risk-platform
├── apps/
│   ├── api/                    # FastAPI Backend
│   │   ├── src/
│   │   │   ├── layers/         # 5 Layer implementations
│   │   │   │   ├── verified_truth/
│   │   │   │   ├── digital_twins/
│   │   │   │   ├── network_intelligence/
│   │   │   │   ├── simulation/
│   │   │   │   └── agents/
│   │   │   ├── api/            # REST + GraphQL endpoints
│   │   │   ├── models/         # Database models
│   │   │   ├── services/       # Business logic
│   │   │   └── core/           # Config, security
│   │   └── tests/
│   │
│   └── web/                    # React Frontend
│       ├── src/
│       │   ├── components/
│       │   ├── features/
│       │   ├── lib/
│       │   └── pages/
│       └── public/
│
├── libs/
│   ├── pars-schema/            # PARS Protocol definitions
│   ├── physics-engine/         # Physics simulations
│   ├── climate-engine/         # Climate data & models
│   ├── financial-models/       # PD, LGD, DCF
│   └── graph-models/           # Network analysis
│
├── infra/
│   ├── docker/
│   ├── k8s/
│   └── terraform/
│
├── data/
│   ├── climate/                # Climate data cache
│   ├── schemas/                # Data schemas
│   └── samples/                # Sample BIM files
│
└── docs/
    ├── architecture/
    ├── api/
    └── guides/
```

---

## 🏃 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (or Docker for infrastructure)
- Redis (or Docker)

### Option 1: Manual Start (Recommended)

**Terminal 1: Docker (optional)**
```bash
docker compose up -d postgres redis neo4j minio
```

**Terminal 2: API Server**
```bash
cd apps/api
source .venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
```

**Terminal 3: Web Server**
```bash
cd apps/web
npm run dev
```

### Option 2: Automated Start

```bash
# Start all services in background with auto-restart
./start-all-services.sh

# Stop all services
./stop-all-services.sh
```

### Option 3: Brev (GPU cloud)

```bash
./scripts/brev-full-deploy.sh
# Port Forward 9002, 5180 in Brev UI
```

📖 **Brev:** [docs/BREV_DEPLOYMENT.md](docs/BREV_DEPLOYMENT.md) | **Contabo:** [docs/DEPLOY_CONTABO.md](docs/DEPLOY_CONTABO.md) (`./scripts/deploy-contabo-now.sh`) | **Local:** [QUICK_START.md](QUICK_START.md)

---

## 🌐 Access (after startup)

- **Command Center (main screen):** [http://127.0.0.1:5180/command](http://127.0.0.1:5180/command)
- **Web UI (dashboard):** [http://127.0.0.1:5180](http://127.0.0.1:5180)
- **API:** http://localhost:9002
- **API Docs:** http://localhost:9002/docs
- **System Overseer:** http://localhost:9002/api/v1/oversee/status
- **Strategic Modules registry:** http://localhost:9002/api/v1/strategic-modules
- **Generative AI:** http://localhost:9002/docs#/Generative%20AI (explain-zone, explain-scenario, recommendations, disclosure-draft, synthesize)
- **Neo4j Browser:** http://localhost:7474 (if running)

---

## 📊 Market Opportunity

- **TAM:** €4.7B/year
- **Target:** €500M-1B ARR in 10 years
- **Customers:** G-SIBs, Regional Banks, Insurance, Infrastructure Funds, REITs

---

## ✨ Key Features

### Command Center (`/command`)
- **Unified screen:** 3D globe (Cesium), risk zone map, city and scenario selection
- **Stress tests:** seismic, flood, hurricane, climate, financial, geopolitical, cyber, pandemic; Critical/High/Medium/Low zone calculation
- **Cascade Analysis:** dependency graph, risk propagation (BFS/GNN), “Open in Cascade” from reports
- **Digital Twins:** 3D BIM/IFC, scenario stress tests, export to Cascade
- **Panels:** Zone Metrics, Stress Metrics, Timeline Predictions, Cascade Flow, Command Mode; when a zone is selected — **Explain zone** (Generative AI)
- **Historical events:** comparison with past crises (1929, 2008, 2022, etc.)
- **Agents and monitoring:** SENTINEL, ANALYST, ADVISOR, REPORTER; Agent Monitoring and System Overseer widgets; in alerts — **Read aloud**, **Analyze & Recommend** with Summary block (LLM)
- **AI-Q chat:** floating button → “Ask about risks, portfolio, scenario” (endpoint `/api/v1/aiq/ask`)
- **Reports:** PDF, HTML, LLM summaries, action plans

### System Overseer
- **Automated Health Monitoring:** Real-time system health checks
- **Automatic Issue Resolution:** Self-healing capabilities for common problems
- **Circuit Breaker Management:** Automatic detection and recovery from service failures
- **Executive Summaries:** AI-powered system status reports
- **Alert Management:** Intelligent alerting with severity levels

📖 **Documentation:** [FIX_CIRCUIT_BREAKERS.md](FIX_CIRCUIT_BREAKERS.md), [CIRCUIT_BREAKERS_INFO.md](CIRCUIT_BREAKERS_INFO.md)

### Strategic Modules v2.0
- **Module registry:** `GET /api/v1/strategic-modules` — list of registered modules (CIP, SCSS, SRO registered at startup)
- **CIP (Critical Infrastructure Protection):** Infrastructure risk modeling, `/api/v1/cip`
- **SCSS (Supply Chain Sovereignty System):** Supply chain mapping and risk analysis, `/api/v1/scss`
- **SRO (Systemic Risk Observatory):** Financial-physical risk integration, `/api/v1/sro`
- **SRS, CityOS, FST:** in roadmap (Phase 1); SRS/CityOS — design and MVP in later years

📖 **Documentation:** [STRATEGIC_MODULES_V2_VISION.md](docs/architecture/STRATEGIC_MODULES_V2_VISION.md), [STRATEGIC_MODULES_V2_ROADMAP.md](docs/architecture/STRATEGIC_MODULES_V2_ROADMAP.md)

### Resilience Patterns
- **Circuit Breakers:** Automatic service isolation on failures
- **Retry with Backoff:** Intelligent retry mechanisms
- **Fallback Mechanisms:** Graceful degradation when services are unavailable
- **Health Checks:** Comprehensive service health monitoring

### 3D Visualization
- **CesiumJS Globe:** Interactive 3D globe with risk hotspots (including on Command Center screen)
- **Real-time Updates:** WebSocket-based live data streaming
- **Risk Visualization:** Color-coded risk indicators and heatmaps

### Generative AI (reports, explanations, recommendations, regulation)
- **Reports and summaries:** Executive Summary in stress test report; **Read aloud** button (browser TTS; optional Riva when enabled on Linux+NVIDIA GPU) — in alerts and in report
- **Scenario explanation:** **Explain zone** — in zone panel in Command Center; **Explain scenario** — in report (`/report`), “Generative AI” section
- **Recommendations:** In report — **Get recommendations** button (LLM text)
- **Documents/regulation:** In report — NGFS/EBA/Fed selector and **Generate disclosure draft** button
- **Chat and Q&A:** Command Center — floating button → AIAssistant (AI-Q with context and sources)
- **Agent explanations:** In “Analyze & Recommend” modal for an alert — **Summary** block (short LLM explanation)
- **Data synthesis:** API `POST /api/v1/generative/synthesize` (weather + geo + historical events → one text); no UI button yet

📖 **Documentation:** [GENERATIVE_AI_USE_CASES.md](docs/GENERATIVE_AI_USE_CASES.md), [GENERATIVE_AI_UI_CHECKLIST.md](docs/GENERATIVE_AI_UI_CHECKLIST.md)

### NVIDIA — полный список (как в блоке NVIDIA Services в Command Center)

Соответствует данным `GET /api/v1/health/nvidia` и блоку **NVIDIA Services** на дашборде.

| Сервис в дашборде | Статус по умолчанию | Когда работает |
|-------------------|---------------------|-----------------|
| **NVIDIA LLM (Cloud API)** | OK при наличии ключа | `NVIDIA_API_KEY` — агенты, отчёты, Generative AI (Llama 3.1). |
| **NVIDIA AI Orchestration** | OK при наличии ключа | Тот же ключ — мультимодельный консенсус для стресс-тестов. |
| **Earth-2 FourCastNet NIM** | disabled | `USE_LOCAL_NIM` + `fourcastnet_nim_url`, контейнер на Linux+NVIDIA GPU. |
| **Earth-2 CorrDiff NIM** | disabled | `USE_LOCAL_NIM` + `corrdiff_nim_url`, контейнер на Linux+NVIDIA GPU. |
| **FLUX.1-dev NIM** | по конфигу/доступности | `flux_nim_url` — генерация изображений для REPORTER. |
| **NVIDIA Earth-2** | по конфигу/доступности | `earth2_api_url` — климат/погода в climate_data. |
| **PhysicsNeMo** | по конфигу/доступности | `physics_nemo_api_url` — слой физических симуляций. |
| **NVIDIA Riva** | disabled | `ENABLE_RIVA=true` + развёрнутый Riva (Linux+NVIDIA GPU). Озвучка алертов и отчётов. |
| **NVIDIA Dynamo** | disabled | `ENABLE_DYNAMO=true` + развёрнутый Dynamo (Linux+NVIDIA GPU). |
| **Triton Inference Server** | disabled | `ENABLE_TRITON=true` + развёрнутый Triton (Linux+NVIDIA GPU). |
| **NeMo Retriever** | OK (по конфигу) | `nemo_retriever_enabled` — RAG, цитаты в AI-Q. |
| **NeMo Guardrails** | OK (по конфигу) | `nemo_guardrails_enabled` — проверки перед выводом агентов. |
| **NeMo Agent Toolkit** | OK (по конфигу) | `nemo_agent_toolkit_enabled` — мониторинг агентов. |
| **NeMo Curator** | OK (по конфигу) | `nemo_curator_enabled` — курация данных. |
| **NeMo Data Designer** | OK (по конфигу) | `nemo_data_designer_enabled` — синтетические данные. |
| **NeMo Evaluator** | OK (по конфигу) | `nemo_evaluator_enabled` — оценка агентов. |

**Озвучка «Read aloud»:** без сервера — через **Web Speech API** в браузере (Mac, Windows, Linux). Опционально — Riva, когда включён и развёрнут.

**Живой статус в UI:** блок **NVIDIA Services** в Command Center показывает для каждого сервиса включён/выключен, URL, Source, Call. «OK» для NIM/Earth-2/PhysicsNeMo — при успешной проверке доступности; для NeMo Retriever/Guardrails и т.д. — «включено в конфиге».

**Health API:** `GET /api/v1/health/nvidia`, `/api/v1/nvidia/riva/health`, `/api/v1/nvidia/dynamo/health`, `/api/v1/nvidia/triton/health`.

📖 **Documentation:** [GTC_NVIDIA_SETUP.md](docs/GTC_NVIDIA_SETUP.md), [NVIDIA_IMPLEMENTATION_ROADMAP.md](docs/NVIDIA_IMPLEMENTATION_ROADMAP.md), [NVIDIA_INTEGRATION.md](docs/NVIDIA_INTEGRATION.md), [RIVA_DEPLOY.md](docs/RIVA_DEPLOY.md)

### Other application sections
- **Assets** — asset catalogue, details, risks
- **CIP, SRO, SCSS, BIM** — industry modules
- **Analytics, Risk Zones, Portfolios, Projects, Fraud** — analytics and specialised modules
- **Stress test report** — page `/report` (Executive Summary + Generative AI section: Explain scenario, Get recommendations, Generate disclosure draft)
- **Landing:** WordPress templates in `saa-landing/`, `saa-landing/wp-pages/`

---

## 📚 Documentation

### 🗺️ Navigation
- **[MASTER_PLAN.md](MASTER_PLAN.md)** ⭐ **MASTER PLAN** — central document with full navigation
- **[ОПИСАНИЕ_ПРОЕКТА_RU.md](ОПИСАНИЕ_ПРОЕКТА_RU.md)** — short platform description (RU)
- **[saa-landing/wp-pages/SETUP_WORDPRESS_PAGES.md](saa-landing/wp-pages/SETUP_WORDPRESS_PAGES.md)** — SAA WordPress pages setup

### 🎯 Vision and strategy
- **[Strategic Modules v2.0](docs/architecture/STRATEGIC_MODULES_V2_VISION.md)** — Module architecture (30-year horizon)
- **[Five Layers](docs/architecture/FIVE_LAYERS.md)** — Five-layer architecture
- **[Product Model](docs/PRODUCT_MODEL_3D_FINTECH.md)** — Product model

### 🚀 Quick start
- **[Quick Start Guide](QUICK_START.md)** — Quick project launch
- **[Services Management](SERVICES_MANAGEMENT.md)** — Services management
- **[Check Services](CHECK_SERVICES.md)** — Service diagnostics

### 🛠️ Technical documentation
- **[System Overseer](FIX_CIRCUIT_BREAKERS.md)** — System management
- **[Circuit Breakers](CIRCUIT_BREAKERS_INFO.md)** — Circuit breakers info
- **[Risk Calculation](docs/RISK_CALCULATION.md)** — Risk calculation
- **[Generative AI Use Cases](docs/GENERATIVE_AI_USE_CASES.md)** — Generative AI directions and endpoints
- **[Generative AI UI Checklist](docs/GENERATIVE_AI_UI_CHECKLIST.md)** — Where in UI: Explain zone, Explain scenario, recommendations, disclosure, chat
- **[NVIDIA Implementation Roadmap](docs/NVIDIA_IMPLEMENTATION_ROADMAP.md)** — Riva, Dynamo, Triton, optional services

---

## 🎯 Milestones

- [x] Month 1-2: Foundation + 3D Viewer
- [x] Month 3-4: Climate + Physics Simulation
- [x] Month 5-6: MVP + Alpha Users
- [x] System Overseer Integration
- [x] Strategic Modules v2.0 (CIP, SCSS, SRO + registry `/strategic-modules`)
- [x] Resilience Patterns (Circuit Breakers, Retry, Fallback)
- [x] Generative AI: zone/scenario explanations, recommendations, disclosure draft, AI-Q chat, Summary in alerts
- [x] NVIDIA: Cloud API (LLM), integration code for Riva/Dynamo/Triton (optional; Riva/Dynamo/Triton require Linux+NVIDIA GPU), voice via browser TTS, health endpoints
- [ ] Month 7-8: First Paying Customers
- [ ] Month 9-12: Enterprise Features

---

## 🔧 Troubleshooting

### Circuit Breakers Open
If you see circuit breaker warnings (Neo4j, MinIO, Timescale) — this is **not critical**. The platform runs without them. See [CIRCUIT_BREAKERS_INFO.md](CIRCUIT_BREAKERS_INFO.md)

### Services Not Starting
Check [CHECK_SERVICES.md](CHECK_SERVICES.md) for service startup diagnostics.

### API Not Responding
Ensure the API server is running on port 9002. See [QUICK_START.md](QUICK_START.md)

---

## 🌐 Related: SAA Alliance & Live Demos

**Site:** [saa-alliance.com](https://saa-alliance.com) — landing (About, Team, Platform, How it works, Contact, FAQ, Privacy, Terms).

**Ecosystem modules (pages and services):** Risk Analyzer, ARIN Platform, Investment Dashboard, Crypto Analytics Portal, News &amp; Analytics Portal — described on the site and in [saa-landing/wp-pages/SETUP_WORDPRESS_PAGES.md](saa-landing/wp-pages/SETUP_WORDPRESS_PAGES.md). This repository is the core **Physical-Financial Risk Platform** and Command Center.

---

**Version:** 0.2.0  
**Status:** Active Development - Alpha  
**Last Updated:** January 2026  

Current state: Command Center with 3D globe, stress tests, risk zones, Cascade, Digital Twin, agents (SENTINEL, ANALYST, ADVISOR, REPORTER), System Overseer, Strategic Modules (CIP, SCSS, SRO + registry), Generative AI (explanations, recommendations, disclosure draft, AI-Q chat). **NVIDIA реально используется:** только Cloud API для LLM (при наличии `NVIDIA_API_KEY`); озвучка — Web Speech API в браузере. Riva, Dynamo, Triton — код интеграции есть, по умолчанию выключены; для работы нужны Linux и NVIDIA GPU (Riva NIM — платная подписка).
