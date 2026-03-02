# Phase 1 "Под Ключ" — Full Implementation Plan (24 months)

**Version:** 1.0  
**Date:** February 2026  
**Status:** Approved for development  
**Reference:** [STRATEGIC_MODULES_ROADMAP.md](STRATEGIC_MODULES_ROADMAP.md) Phase 1, [STRATEGIC_MODULES_IMPLEMENTATION.md](STRATEGIC_MODULES_IMPLEMENTATION.md)

This document integrates the comprehensive Phase 1 implementation plan from architecture through production-ready system. Current repo layout: **backend** = `apps/api/`, **frontend** = `apps/web/`.

---

## 1. Scope of Work (Phase 1, 24 months)

| # | Component | Description |
|---|-----------|-------------|
| 1 | **Base Framework** | StrategicModule base, ModuleRegistry, RBAC, KG service, simulation engine base |
| 2 | **CIP Module** | Critical Infrastructure Protection — assets, dependencies, cascade simulation, CIP_SENTINEL |
| 3 | **SCSS Module** | Supply Chain Sovereignty — suppliers, supply chains, bottlenecks, geopolitical sim, SCSS_ADVISOR |
| 4 | **SRO Module** | Systemic Risk Observatory — institutions, markets, correlations, contagion sim, SRO_SENTINEL |
| 5 | **Integration Layer** | Cross-module KG, multi-module simulations, unified dashboard |
| 6 | **Dashboard** | UI for all 3 modules (CIP, SCSS, SRO) + unified overview |
| 7 | **API** | REST (primary) + optional GraphQL (Year 2) |
| 8 | **Agent System** | SENTINEL (CIP, SRO), ADVISOR (SCSS), orchestration |
| 9 | **Simulation Engine** | Cascades (CIP), geopolitical (SCSS), financial contagion (SRO) |
| 10 | **Knowledge Graph** | Extended for CIP/SCSS/SRO nodes and edges, cross-module queries |

---

## 2. Project Structure (mapped to current repo)

```
global-risk-platform/                    # Repo root
│
├── apps/
│   ├── api/                             # Backend (FastAPI)
│   │   ├── src/
│   │   │   ├── core/                    # Base system
│   │   │   │   ├── config.py
│   │   │   │   ├── database.py
│   │   │   │   └── (auth, middleware as needed)
│   │   │   │
│   │   │   ├── modules/                 # Strategic modules
│   │   │   │   ├── base.py              # StrategicModule base class
│   │   │   │   ├── registry.py          # ModuleRegistry
│   │   │   │   ├── cip/                 # CIP Module
│   │   │   │   │   ├── models.py
│   │   │   │   │   ├── service.py
│   │   │   │   │   ├── module.py
│   │   │   │   │   └── agents.py        # CIP_SENTINEL
│   │   │   │   ├── scss/                # SCSS Module
│   │   │   │   │   ├── models.py
│   │   │   │   │   ├── service.py
│   │   │   │   │   ├── module.py
│   │   │   │   │   └── agents.py        # SCSS_ADVISOR
│   │   │   │   └── sro/                 # SRO Module
│   │   │   │       ├── models.py
│   │   │   │       ├── service.py
│   │   │   │       ├── module.py
│   │   │   │       └── agents.py        # SRO_SENTINEL
│   │   │   │
│   │   │   ├── api/v1/endpoints/
│   │   │   │   ├── cip.py
│   │   │   │   ├── scss.py
│   │   │   │   ├── sro.py
│   │   │   │   ├── strategic_modules.py
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── layers/agents/           # Agent framework
│   │   │   │   ├── sentinel.py
│   │   │   │   └── (advisor base as needed)
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── knowledge_graph.py   # KG service
│   │   │   │   ├── (cascade_engine, geopolitical, contagion as needed)
│   │   │   │   └── ...
│   │   │   │
│   │   │   └── models/                  # Shared/core models
│   │   │       ├── asset.py
│   │   │       └── ...
│   │   │
│   │   ├── alembic/versions/            # Migrations
│   │   ├── main.py
│   │   └── pyproject.toml / requirements
│   │
│   └── web/                             # Frontend (React + TypeScript)
│       ├── src/
│       │   ├── components/
│       │   │   ├── modules/
│       │   │   │   ├── AccessGate.tsx
│       │   │   │   └── ...
│       │   │   ├── (cip/, scss/, sro/ as needed)
│       │   │   └── ...
│       │   ├── pages/
│       │   │   ├── modules/
│       │   │   │   ├── CIPModule.tsx
│       │   │   │   ├── SCSSModule.tsx
│       │   │   │   └── SROModule.tsx
│       │   │   └── ...
│       │   ├── services/
│       │   │   ├── cipApi.ts
│       │   │   └── ...
│       │   └── App.tsx
│       ├── package.json
│       └── vite.config.ts
│
├── docs/
│   └── architecture/
│       ├── STRATEGIC_MODULES_ROADMAP.md
│       ├── STRATEGIC_MODULES_PHASE1_FULL_IMPLEMENTATION.md  # This file
│       └── STRATEGIC_MODULES_PHASE1_SPEC.md                 # ТЗ summary
│
├── docker-compose.yml
├── Dockerfile(s)
└── scripts/
```

---

## 3. Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic |
| **Database** | PostgreSQL 15+ (PostGIS, pg_trgm); SQLite for local dev |
| **Knowledge Graph** | Neo4j 5.x (optional; config-driven) |
| **Cache / Queue** | Redis (optional); Celery for agents if needed |
| **Frontend** | React 18, TypeScript, Vite, Tailwind; Zustand or existing store |
| **Maps** | Mapbox GL JS (CIP); Cesium/Mapbox as in current app |
| **Graphs** | D3, Recharts, Cytoscape.js or similar for dependency/supply chain |
| **Infra** | Docker, Docker Compose; optional K8s/GitHub Actions |

---

## 4. Detailed Timeline (24 months)

### Quarter 1 (Months 1–3): Foundation

| Month | Focus | Deliverables |
|-------|--------|--------------|
| **1** | Core architecture | Repo structure, Docker dev env, DB schema (core), FastAPI app, JWT auth; Base StrategicModule, ModuleRegistry, access control (RBAC or level-based), KG service skeleton, basic API (/auth, /modules). |
| **2** | CIP foundation | CIP models (infrastructure, dependency, cascade scenario); migrations; CRUD API; infrastructure service; dependency mapping; basic cascade simulator (BFS); KG integration (INFRASTRUCTURE nodes). |
| **3** | CIP MVP | Base agent framework; CIP_SENTINEL (polling-based); alert system; frontend: infrastructure list/map, asset detail, simple dependency graph. **Milestone:** CIP MVP demo-ready. |

### Quarter 2 (Months 4–6): CIP Production + SCSS Start

| Month | Focus | Deliverables |
|-------|--------|--------------|
| **4** | CIP advanced | Time-based/probabilistic cascade simulation; recovery estimation; dashboard polish (monitoring, cascade UI, alerts, PDF export). |
| **5** | CIP pilot + SCSS start | CIP production-ready (perf, security, docs); first pilot deployment; SCSS models (Supplier, SupplyChain, RawMaterial, Bottleneck). |
| **6** | SCSS services | Supply chain mapping; bottleneck identification; KG (SUPPLIER, FACTORY nodes); geopolitical scenario modeling. **Milestone:** CIP in production; SCSS MVP. |

### Quarter 3 (Months 7–9): SCSS Production

| Month | Focus | Deliverables |
|-------|--------|--------------|
| **7** | SCSS_ADVISOR | Alternative supplier finder; multi-criteria scoring; SCSS_ADVISOR agent; SCSS dashboard (supply chain viz, bottleneck heatmap, recommendations). |
| **8–9** | SCSS production + integration | SCSS optimization; cross-module (CIP ↔ SCSS): link factories to infrastructure, cascade impact on supply chains; multi-module dashboard; SCSS pilot. **Milestone:** SCSS production-ready; 2 modules operational. |

### Quarter 4 (Months 10–12): SRO Foundation

| Month | Focus | Deliverables |
|-------|--------|--------------|
| **10–11** | SRO models & services | FinancialInstitution, Market, SystemicIndicator; correlation analyzer; financial contagion simulator; KG (BANK, MARKET nodes). |
| **12** | SRO MVP | SRO_SENTINEL; early warning; systemic risk dashboard; integration tests (all 3 modules). **Milestone:** Year 1 complete; 3 modules operational. |

### Year 2 (Months 13–24): Production, Scale, Revenue

| Period | Focus | Key items |
|--------|--------|-----------|
| **13–15** | SRO production | Financial data integration; advanced contagion; regulatory reporting; SRO pilot. |
| **16–18** | Platform maturity | Multi-tenancy; ML for predictive alerts; mobile (optional); API v2/GraphQL; scale (1000+ assets, 100+ supply chains). |
| **19–21** | Revenue focus | Sales enablement; customer success; partnerships; marketplace (extensions). |
| **22–24** | Phase 2 prep | Security clearance applications; SBIR/STTR; ASM module design. **Milestone:** ~$15M ARR; Phase 1 complete. |

---

## 5. Base Framework (reference)

- **StrategicModule:** [apps/api/src/modules/base.py](apps/api/src/modules/base.py) — `StrategicModule` ABC with `get_layer_dependencies`, `get_knowledge_graph_nodes`, `get_knowledge_graph_edges`, `get_simulation_scenarios`, `get_agents`, `get_api_prefix`, `check_access`. Extend with `CODE`, `NAME`, `PHASE`, `get_models()`, `get_router()`, `get_graph_schema()`, `on_install`/`health_check` as in [STRATEGIC_MODULES_PHASE1_SPEC.md](STRATEGIC_MODULES_PHASE1_SPEC.md) if moving to full ТЗ.
- **ModuleRegistry:** [apps/api/src/modules/registry.py](apps/api/src/modules/registry.py) — `register`, `get`, `list_all`, `list_by_access_level`. Optional: `get_by_phase`, `check_dependencies`.
- **Access control:** [docs/architecture/STRATEGIC_MODULES_REGISTRY_AND_ACCESS.md](STRATEGIC_MODULES_REGISTRY_AND_ACCESS.md) — current access-level model; RBAC/permissions as in ТЗ can be added via `require_permission("cip.edit_infrastructure")` etc.

---

## 6. CIP Module (reference)

- **Models:** [apps/api/src/modules/cip/models.py](apps/api/src/modules/cip/models.py) — `CriticalInfrastructure`, `InfrastructureDependency`; tables `cip_infrastructure`, `cip_dependencies`.
- **Service:** [apps/api/src/modules/cip/service.py](apps/api/src/modules/cip/service.py) — register/list/update/delete infrastructure; dependencies; cascade risk; KG sync when Neo4j enabled.
- **Agent:** [apps/api/src/modules/cip/agents.py](apps/api/src/modules/cip/agents.py) — `CIPSentinelAgent.run_cycle(db)`; integrated in [apps/api/src/api/v1/endpoints/alerts.py](apps/api/src/api/v1/endpoints/alerts.py).
- **API:** [apps/api/src/api/v1/endpoints/cip.py](apps/api/src/api/v1/endpoints/cip.py) — REST: assets, dependencies, cascade-risk, vulnerability, types/criticality.
- **Cascade simulator:** In-service `calculate_cascade_risk` (graph BFS). Full time-based/probabilistic simulator can follow ТЗ algorithm (BFS + failure_probability + delay_minutes).

---

## 7. Budget Estimate (24 months)

| Category | Estimate |
|----------|----------|
| **Personnel (Year 1)** | Technical Lead + 2 Backend + 1 Frontend + PM + 0.5 DevOps + 0.5 Designer ≈ $850K |
| **Personnel (Year 2)** | + new hires ≈ $1.3M total |
| **Infrastructure** | ~$3K/mo × 24 + tools ~$2K/mo × 24 ≈ $120K |
| **Other** | Legal, marketing, sales, contingency (e.g. 15%) ≈ $580K |
| **Total Phase 1** | ~$2.85M (24 months) |

---

## 8. Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Scope creep | MVP per module first; strict acceptance criteria (see Spec). |
| Performance at scale | Load testing early; indexes; Redis; read replicas. |
| Data silos | Shared KG; cross-module APIs from start. |
| Key person dependency | Documentation; knowledge sharing; bus factor > 1. |
| Security | Security audit (e.g. Q3 Year 1); SOC 2 path; penetration testing. |

---

## 9. Success Criteria (summary)

- **Month 6:** CIP MVP deployed; API p95 < 200ms; coverage > 80%.
- **Month 12:** CIP production; SCSS MVP; 1000+ assets; 99.5% uptime.
- **Month 18:** All 3 modules production; 10K+ assets, 500+ supply chains; 99.9% uptime.
- **Month 24:** Cross-module simulations; API v2/GraphQL; ~$10–15M ARR.

---

## 10. Related Documents

- [STRATEGIC_MODULES_ROADMAP.md](STRATEGIC_MODULES_ROADMAP.md) — 30-year roadmap; Phase 1 goals and milestones.
- [STRATEGIC_MODULES_IMPLEMENTATION.md](STRATEGIC_MODULES_IMPLEMENTATION.md) — Directory structure, base class, integration patterns.
- [STRATEGIC_MODULES_PHASE1_SPEC.md](STRATEGIC_MODULES_PHASE1_SPEC.md) — Technical Specification (ТЗ): FR, NFR, API, UI, DB/KG, acceptance criteria.
- [STRATEGIC_MODULES_REGISTRY_AND_ACCESS.md](STRATEGIC_MODULES_REGISTRY_AND_ACCESS.md) — Registry and access control (current vs optional RBAC).
