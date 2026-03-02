# Strategic Modules Platform — Phase 1 Technical Specification (ТЗ)

**Version:** 1.0  
**Date:** 03 February 2026  
**Status:** Approved for development  
**Implementation period:** 24 months

This document summarizes the Technical Specification for Phase 1. Full narrative FR/NFR text can be expanded from this structure.

---

## 1. General

### 1.1 Project name
Strategic Modules Platform — modular platform for managing civilization-scale risks (critical infrastructure, supply chains, systemic financial risk).

### 1.2 Goals

**Business:**
- Reach $15M+ ARR by end of Phase 1 (24 months).
- 18+ enterprise customers (utilities, manufacturing, banks).
- Prove Product-Market Fit for all 3 modules (CIP, SCSS, SRO).
- Foundation for Phase 2 (government contracts).

**Technical:**
- Scalable modular architecture.
- Support 1000+ infrastructure assets, 1000+ supply chains.
- 99.9% uptime for production modules.
- API response time p95 < 200ms.

### 1.3 Target users and roles
- Operators of critical infrastructure (utilities, smart cities).
- Supply chain managers (manufacturing, retail).
- Risk managers in financial institutions; regulators (central banks).
- Roles: Admin, Infrastructure Manager, Supply Chain Analyst, Risk Analyst, Viewer.

---

## 2. Functional Requirements (summary)

### 2.1 CIP Module

| ID | Requirement | Priority | API / UI |
|----|-------------|----------|----------|
| FR-CIP-001 | Register infrastructure assets (name, type, category, coordinates, capacity, status, criticality) | Critical | POST /api/v1/cip/assets |
| FR-CIP-002 | View assets on interactive map (Mapbox); filters by type, category, status | High | GET /api/v1/cip/assets |
| FR-CIP-003 | Asset detail: characteristics, history, dependencies, monitoring, alerts | High | GET /api/v1/cip/assets/{id} |
| FR-CIP-004 | Create dependencies between assets (dependent, dependency, type, strength, failure_prob, delay_min); no cycles | Critical | POST /api/v1/cip/dependencies |
| FR-CIP-005 | Visualize dependency graph (nodes = assets, edges = dependencies; Cytoscape/D3) | High | GET /api/v1/cip/dependencies/graph |
| FR-CIP-006 | Run cascade simulation (initial failures, time horizon); BFS + probabilistic propagation; timeline, affected_assets, impact_score, recovery_time | Critical | POST /api/v1/cip/simulations/cascade |
| FR-CIP-007 | Visualize simulation: timeline chart, animated graph, heatmap, summary | High | UI + GET /api/v1/cip/simulations/{id} |
| FR-CIP-008 | CIP_SENTINEL: continuous monitoring; anomaly/cascade/maintenance alerts; email, in-app, webhook | Critical | GET /api/v1/cip/alerts; POST monitoring/enable, alerts/acknowledge |
| FR-CIP-009 | CIP dashboard: KPIs, map, recent simulations, alert feed (real-time) | High | /cip/dashboard |

### 2.2 SCSS Module

| ID | Requirement | Priority | API / UI |
|----|-------------|----------|----------|
| FR-SCSS-001 | Register suppliers (name, country, materials, capacity, lead time, geopolitical risk) | Critical | POST /api/v1/scss/suppliers |
| FR-SCSS-002 | Map supply chain: raw material → component → product; tiers and links | Critical | POST /api/v1/scss/supply-chains |
| FR-SCSS-003 | Visualize supply chain (Sankey/hierarchical graph; risk coloring) | High | GET /api/v1/scss/supply-chains/{id}/graph |
| FR-SCSS-004 | Identify bottlenecks (single point of failure, concentration, high risk + dependency); bottleneck score | High | POST /api/v1/scss/supply-chains/{id}/analyze-bottlenecks |
| FR-SCSS-005 | Bottleneck heatmap on world map | Medium | GET /api/v1/scss/bottlenecks/heatmap |
| FR-SCSS-006 | Geopolitical simulation (trade_war, sanctions, disaster, instability); impact on suppliers and chains | Critical | POST /api/v1/scss/simulations/geopolitical |
| FR-SCSS-007 | SCSS_ADVISOR: alternative supplier recommendations (multi-criteria: risk, cost, lead time, diversification) | High | POST /api/v1/scss/recommendations/alternative-suppliers |
| FR-SCSS-008 | SCSS dashboard: suppliers, chains, bottlenecks, risk, simulations, recommendations | High | /scss/dashboard |

### 2.3 SRO Module

| ID | Requirement | Priority | API / UI |
|----|-------------|----------|----------|
| FR-SRO-001 | Register financial institutions (name, type, country, total_assets, exposures, interconnectedness) | Critical | POST /api/v1/sro/institutions |
| FR-SRO-002 | Register markets (name, asset_class, market_cap, volatility) | High | POST /api/v1/sro/markets |
| FR-SRO-003 | Financial–physical correlation analysis (CIP/SCSS events vs financial data); significant correlations | Critical | POST /api/v1/sro/analysis/correlations |
| FR-SRO-004 | Systemic risk indicators (CoVaR, interconnectedness, concentration, contagion probability) | High | GET /api/v1/sro/indicators |
| FR-SRO-005 | Contagion simulation (initial default, severity, horizon; direct/indirect/panic contagion) | Critical | POST /api/v1/sro/simulations/contagion |
| FR-SRO-006 | Contagion network visualization (institutions, exposures, animated propagation) | High | GET /api/v1/sro/simulations/{id}/network |
| FR-SRO-007 | SRO_SENTINEL: early warning (CoVaR spike, distressed cluster, correlation breakdown, physical–financial spike) | Critical | GET /api/v1/sro/alerts |
| FR-SRO-008 | SRO dashboard: systemic score, risky institutions, market stress, alerts, correlations | High | /sro/dashboard |

### 2.4 Cross-Module

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CROSS-001 | Unified Knowledge Graph: CIP/SCSS/SRO nodes and edges; cross-module queries (e.g. supply chains depending on infrastructure in zone X) | Critical |
| FR-CROSS-002 | Multi-module simulations (e.g. infrastructure failure → supply chain disruption → financial contagion) | High |
| FR-CROSS-003 | Unified dashboard: overview of all 3 modules, cross-module alerts, recent multi-module simulations | Medium |

---

## 3. Non-Functional Requirements (summary)

| ID | Area | Requirement |
|----|------|--------------|
| NFR-PERF-001 | API | p95 < 200ms CRUD; p95 < 2s simulations; p99 < 5s complex graph queries |
| NFR-PERF-002 | Scale | 1000+ assets, 1000+ supply chains per org; 100+ concurrent simulations; 10K+ concurrent users (global) |
| NFR-AVAIL-001 | Uptime | 99.9% production; 99.5% staging |
| NFR-AVAIL-002 | DR | RTO < 4h; RPO < 15 min; automated backups |
| NFR-SEC-001 | Auth | JWT; optional MFA; OAuth 2.0 for SSO |
| NFR-SEC-002 | Authz | RBAC (Admin, Infrastructure Manager, Supply Chain Analyst, Risk Analyst, Viewer); row-level by organization |
| NFR-SEC-003 | Crypto | TLS 1.3; encryption at rest; secrets manager; bcrypt for passwords |
| NFR-SEC-004 | Audit | Log CRUD, auth events, simulation runs; 1 year retention |
| NFR-SEC-005 | Compliance | GDPR; SOC 2 Type II target Year 2 |
| NFR-SCALE-001 | Scaling | Stateless API; horizontal scaling; read replicas; Redis cache |
| NFR-SCALE-002 | Isolation | Module DB schemas (cip_*, scss_*, sro_*); enable/disable per org |
| NFR-TEST-001 | Coverage | Backend ≥ 80%; frontend ≥ 70% |
| NFR-TEST-002 | Tests | Unit (pytest, Jest); integration; E2E (Playwright/Cypress); load (e.g. Locust/k6) |
| NFR-TEST-003 | CI/CD | Tests on every PR; deploy only if pass; staging on merge to develop; production with approval |

---

## 4. Architecture (high level)

```
Frontend (React) — CIP / SCSS / SRO UI
        │ HTTPS (REST / optional GraphQL)
        ▼
API Gateway / Load Balancer
        │
        ▼
Backend (FastAPI)
  — Core: Auth, RBAC, ModuleRegistry, KG Service, Simulation Engine
  — Modules: CIP, SCSS, SRO (models, routes, agents)
        │
        ├── PostgreSQL (relational; core + cip_*, scss_*, sro_*)
        ├── Neo4j (Knowledge Graph)
        └── Redis (cache + optional queue for agents)
        │
        └── Celery workers (CIP_SENTINEL, SCSS_ADVISOR, SRO_SENTINEL)
```

---

## 5. Database Schema (summary)

- **Core:** organizations, users, strategic_modules, module_permissions, user_permissions (or equivalent).
- **CIP:** cip_infrastructure_assets, cip_dependencies, cip_cascade_scenarios, cip_alerts (indexes on org_id, type, status).
- **SCSS:** scss_suppliers, scss_supply_chains, scss_bottlenecks.
- **SRO:** sro_financial_institutions, sro_markets, sro_systemic_indicators, sro_alerts.

Current implementation: [apps/api/src/modules/cip/models.py](apps/api/src/modules/cip/models.py) (cip_infrastructure, cip_dependencies); SCSS/SRO in [apps/api/alembic/versions](apps/api/alembic/versions) and module folders.

---

## 6. Knowledge Graph Schema (summary)

- **CIP:** Nodes SUBSTATION, TRANSFORMER, POWER_LINE, WATER_PUMP, etc.; edges POWERS, DEPENDS_ON, CONNECTED_TO, REQUIRES_POWER.
- **SCSS:** Nodes SUPPLIER, RAW_MATERIAL, COMPONENT, PRODUCT, FACTORY; edges SUPPLIES, USED_IN, ASSEMBLED_INTO, PRODUCES.
- **SRO:** Nodes BANK, HEDGE_FUND, INSURANCE, MARKET; edges HAS_EXPOSURE, COUNTERPARTY_OF, INVESTED_IN.
- **Cross-module:** e.g. SCSS_FACTORY -[:DEPENDS_ON_INFRASTRUCTURE]-> CIP_SUBSTATION; SRO_BANK -[:FINANCES]-> SCSS_SUPPLIER.

Current: [apps/api/src/services/knowledge_graph.py](apps/api/src/services/knowledge_graph.py) — Infrastructure nodes, DEPENDS_ON; module property can be added for filtering.

---

## 7. API Specification (endpoints summary)

- **Auth:** POST /api/v1/auth/register, login, refresh, logout; GET /api/v1/auth/me.
- **CIP:** POST/GET/PUT/DELETE /api/v1/cip/assets; POST/GET/DELETE /api/v1/cip/dependencies; GET /api/v1/cip/dependencies/graph; POST /api/v1/cip/simulations/cascade; GET /api/v1/cip/simulations; POST /api/v1/cip/monitoring/enable|disable; GET /api/v1/cip/alerts; POST /api/v1/cip/alerts/{id}/acknowledge.
- **SCSS:** POST/GET/PUT /api/v1/scss/suppliers; POST/GET /api/v1/scss/supply-chains; GET /api/v1/scss/supply-chains/{id}/graph; POST /api/v1/scss/supply-chains/{id}/analyze-bottlenecks; GET /api/v1/scss/bottlenecks/heatmap; POST /api/v1/scss/simulations/geopolitical; POST /api/v1/scss/recommendations/alternative-suppliers.
- **SRO:** POST/GET /api/v1/sro/institutions, /api/v1/sro/markets; POST /api/v1/sro/analysis/correlations; GET /api/v1/sro/indicators; POST /api/v1/sro/simulations/contagion; GET /api/v1/sro/simulations/{id}/network; GET /api/v1/sro/alerts; POST /api/v1/sro/alerts/{id}/acknowledge.
- **Cross:** POST /api/v1/simulations/multi-module; GET /api/v1/modules; GET/POST /api/v1/organizations/{id}/modules (enable/disable).

---

## 8. UI Requirements (summary)

- **General:** Responsive; WCAG 2.1 AA; i18n (EN Phase 1); optional dark mode; design system (e.g. shadcn/ui + Tailwind).
- **CIP:** Assets list, Asset map (Mapbox), Asset detail, Dependency graph, Cascade simulator, CIP dashboard.
- **SCSS:** Suppliers list, Supply chains list/detail/graph, Bottleneck heatmap, Geopolitical simulator, Recommendations, SCSS dashboard.
- **SRO:** Institutions list, Markets list, Systemic indicators (time-series), Contagion simulator + network graph, SRO dashboard.
- **Unified:** /dashboard — overview of all modules, cross-module alerts, quick links.

---

## 9. Acceptance Criteria (summary)

- **CIP production:** FR-CIP-001–FR-CIP-009 implemented; coverage > 80%; integration tests; load test 100 concurrent users p95 < 200ms; security audit; docs; ≥ 1 pilot customer.
- **SCSS production:** FR-SCSS-001–FR-SCSS-008; supply chain mapping for 10+ tiers; bottleneck accuracy validated; ≥ 1 pilot.
- **SRO production:** FR-SRO-001–FR-SRO-008; contagion results aligned with literature; financial data integration; ≥ 1 pilot (e.g. central bank).
- **Platform:** NFRs met; 99.9% uptime (3 months); SOC 2 in progress; scale tested (e.g. 10K+ assets); cross-module simulations working.

---

## 10. References

- [STRATEGIC_MODULES_PHASE1_FULL_IMPLEMENTATION.md](STRATEGIC_MODULES_PHASE1_FULL_IMPLEMENTATION.md) — 24-month implementation plan, structure, timeline, budget.
- [STRATEGIC_MODULES_ROADMAP.md](STRATEGIC_MODULES_ROADMAP.md) — 30-year roadmap; Phase 1 milestones.
- [STRATEGIC_MODULES_IMPLEMENTATION.md](STRATEGIC_MODULES_IMPLEMENTATION.md) — Directory structure and integration patterns.
