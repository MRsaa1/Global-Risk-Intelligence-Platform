# SCSS Implementation Plan — 12-Month Accelerated Delivery

## 1. Executive Summary

- **Objective:** Deliver a production-ready SCSS module within **12 months** (vs. original 18) by parallelizing workstreams and reusing existing platform components.
- **Core Innovation:** Transform supply chain visibility from reactive to **predictive** using AI-driven geopolitical simulations and real-time risk monitoring.
- **ROI Acceleration:** Achieve **$1.2M ARR by Month 6** via pilot with automotive client (Tesla case study).

---

## 2. Implementation Phases & Timeline

**Total:** 12 months | **Critical Path:** 9 months

| Phase | Duration | Key Deliverables | Critical Path |
|-------|----------|------------------|----------------|
| **0. Foundation** | Month 1 | SCSS data model finalized; integration contracts with CIP/SRO signed | ✅ |
| **1. Core Engine** | Months 2–4 | FR-SCSS-001 (Suppliers), FR-SCSS-002 (Supply Chain Mapping), FR-SCSS-006 (Geopolitical Simulation) | ✅ |
| **2. Risk Intelligence** | Months 3–6 | FR-SCSS-004 (Bottlenecks), FR-SCSS-007 (SCSS_ADVISOR), ESG/Sanctions compliance engine | ✅ |
| **3. Visualization** | Months 5–7 | FR-SCSS-003 (Sankey Graph), FR-SCSS-005 (Bottleneck Heatmap), Interactive scenario simulator | ❌ |
| **4. Dashboard & Go-to-Market** | Months 8–12 | FR-SCSS-008 (SCSS Dashboard), Pilot with 3 enterprise clients, $5M ARR roadmap | ❌ |

**Accelerator:** Reuse 70% of Simulation Engine from CIP module (saves 3 months).

---

## 3. Technical Implementation Plan

### 3.1 Critical Path Features (Months 2–4)

#### FR-SCSS-001: Supplier Registration

- **API:** `POST /api/v1/scss/suppliers`
- **Tech:** Pydantic models (country codes, risk scores). Persistence: SQLite/PostgreSQL (current `scss_suppliers`); optional MongoDB schema as reference:
  - `name`, `country` (ISO 3166-1 alpha-2), `materials[]`, `capacity`, `lead_time`, `geopolitical_risk` (0–1)
- **Data integration:** OFAC/EU sanctions via daily Cron; country risk enrichment via World Bank API.

#### FR-SCSS-002: Supply Chain Mapping

- **Algorithm:** Multi-tier graph traversal (BFS + DFS hybrid).
  - Start from product node, queue `(node, tier)`; for each node get suppliers from ERP/DB; add edges, enqueue suppliers with `tier+1`; stop at `max_tiers` (e.g. 5).
- **Optimization:** Cache tiers (e.g. Redis); batch ERP (SAP/Oracle) calls.

#### FR-SCSS-006: Geopolitical Simulation

- **Engine:** (1) Inject disruption into supply graph per scenario, (2) Propagate impact (cascading failure), (3) Return impact + recovery_plan + cost_analysis.
- **Scenario library:**

| Scenario Type | Triggers | Impact Model |
|---------------|----------|--------------|
| Trade War | Tariff > 25% | Linear cost increase |
| Sanctions | Country in OFAC list | Immediate supplier cutoff |
| Disaster | Weather severity > 7 | Capacity loss = severity × 10% |

---

### 3.2 High-Priority Features (Months 3–6)

#### FR-SCSS-004: Bottleneck Identification

- **Algorithm:** SPOF score over all simple paths from raw_material to final_product; count nodes whose removal disconnects paths; normalize (e.g. spof_count / path_count).
- **Output:** `bottleneck_score`, `critical_nodes[]` (node, risk_type, impact), `diversification_score`.

#### FR-SCSS-007: SCSS_ADVISOR Agent

- **Multi-criteria weights:** geopolitical_risk 0.35, cost 0.25, lead_time 0.20, quality 0.15, diversification 0.05.
- **Integration:** Consumes SCSS-004 bottleneck data; triggers when `bottleneck_score > 0.7`; returns ranked supplier recommendations.

---

### 3.3 Visualization & Dashboard (Months 5–12)

#### FR-SCSS-003: Supply Chain Graph

- **Stack:** D3.js + React (or existing platform chart/globe stack).
- **Features:** Sankey (material flow raw → product), risk coloring (red/yellow), tier explorer (drill Tier 0–5).

#### FR-SCSS-005: Bottleneck Heatmap

- **Pipeline:** SCSS-004 → stream/API → geospatial index → heatmap generator → Mapbox GL JS (or Cesium).
- **Output:** World map with hotspots (>50% concentration); click → affected products, suppliers, impact score.

#### FR-SCSS-008: SCSS Dashboard

| Module | Data Source | Update Frequency |
|--------|-------------|------------------|
| Risk Monitor | GeopoliticalSimulator | Real-time |
| Bottleneck Map | SCSS-004 Engine | 15 min |
| Simulation Lab | FR-SCSS-006 | On-demand |
| Advisor | SCSS_ADVISOR | Event-triggered |

---

## 4. Integration Architecture

### 4.1 With Existing Platform

- **SCSS → Knowledge Graph:** Add SUPPLIER nodes, PRODUCES/LOCATED_IN edges (materials, country, risk_score).
- **SCSS ↔ CIP:** Geopolitical/infrastructure events (e.g. region, impact) → CIP alerts; CIP infrastructure alerts → SCSS impact on suppliers in region.
- **SCSS ↔ SRO:** Supplier financial risk (e.g. `GET /sro/supplier-financial-risk/{id}` → risk_score 0–1).

### 4.2 External Data Pipelines

| Data Source | Integration Method | Update Frequency |
|-------------|--------------------|------------------|
| OFAC Sanctions | SFTP + daily diff | Daily |
| World Bank Risk | REST API (OAuth) | Weekly |
| Bloomberg News | Webhook (JSON) | Real-time |
| Port Congestion | Web scraper / API | Hourly |

---

## 5. Validation & Success Metrics

### 5.1 Technical KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Supply chain mapping speed | < 5 sec for 100 nodes | Load testing |
| Simulation accuracy | > 90% vs historical events | Backtesting |
| False positive rate (bottlenecks) | < 5% | A/B testing |

### 5.2 Business KPIs

| Metric | Target | Timeline |
|--------|--------|----------|
| Enterprise customers | 10 | Month 12 |
| Supply chains mapped | 1,000+ | Month 10 |
| ARR | $5M+ | Month 12 |
| Crisis avoidance | $20M saved | Month 9 |

**Pilot validation:** Tesla case study must show **40% reduction in China dependency** within 6 months.

---

## 6. Risk Mitigation Plan

| Risk | Mitigation Strategy | Owner |
|------|---------------------|--------|
| Incomplete supplier data | Start with Tier 1–2; ML to infer missing tiers | Data Engineering |
| Slow geopolitical simulations | Pre-compute common scenarios; GPU acceleration | ML Team |
| Low user adoption | Co-design with pilot clients; 3 enterprise champions | Product Manager |

---

## 7. Resource Allocation

| Role | Count | Key Responsibilities |
|------|-------|----------------------|
| Backend Engineers | 4 | API, data pipelines |
| Data Scientists | 3 | Risk models, simulation engine |
| Frontend Engineers | 3 | Dashboard, visualizations |
| DevOps | 2 | Deployment, monitoring |
| Domain Experts | 2 | Supply chain, geopolitical risk |

**Total cost:** $1.8M (within $2M budget). **Timeline buffer:** 3 months (scenario validation).

---

## 8. Go-to-Market Strategy

- **Month 3:** Close pilot with automotive manufacturer (Tesla case as blueprint).
- **Month 6:** Launch SCSS_ADVISOR as standalone feature (low-hanging revenue).
- **Month 9:** Partner with SAP/Oracle for ERP integrations (accelerate enterprise sales).
- **Month 12:** Target 10 customers across automotive, pharma, electronics.

**Pricing model:**

- Base: **$50K/month** (100 supply chains).
- **$5K/month** per 100 additional chains.
- **$10K** for geopolitical simulation add-on.

---

## 9. Why This Plan Wins

- **Faster time-to-value:** Critical path 18 → 9 months.
- **Leverages existing assets:** Reuses ~70% of CIP/SRO infrastructure.
- **Revenue acceleration:** $1.2M ARR by Month 6 via advisor feature.
- **De-risked:** Phased delivery with pilot validation.

**Final deliverable:** A battle-tested SCSS module that turns supply chain risk from liability to competitive advantage — operational readiness on Day 1.

*"We don't just map supply chains — we make them unbreakable."* — SCSS Implementation Team Lead

---

## Implementation Status (backend)

| FR / Feature | Status | Notes |
|--------------|--------|--------|
| FR-SCSS-001 Suppliers | ✅ | POST/GET/PATCH/DELETE `/scss/suppliers`; `materials`, `capacity`, `lead_time_days`, `geopolitical_risk` in create/update |
| FR-SCSS-002 Supply Chain Mapping | ✅ | GET `/scss/chain/map?root_supplier_id=&max_tiers=5` — BFS graph, nodes by tier, edges, geographic summary |
| FR-SCSS-004 Bottlenecks | ✅ | POST/GET `/scss/bottlenecks` — SPOF, high_geopolitical_critical, concentration; `diversification_score` in response |
| FR-SCSS-006 Geopolitical Simulation | ✅ | POST `/scss/simulate` — scenarios: `trade_war`, `sanctions`, `disaster`; impact, recovery_plan, cost_analysis |
| FR-SCSS-007 SCSS_ADVISOR | ✅ | POST `/scss/recommendations/alternative-suppliers` — ranked alternatives by risk/country/sovereignty |
| FR-SCSS-003 Sankey / FR-SCSS-005 Map | ✅ | Frontend: SupplyChainSankey, SupplyChainMap; view toggle Network \| Sankey \| Map |
| FR-SCSS-008 Dashboard | ❌ | Frontend; APIs ready |
| Chain map metrics | ✅ | chain/map returns lead_time_days, single_points_of_failure, critical_bottlenecks_count, resilience_score; optional max_nodes |
| Simulate Phase 4 | ✅ | timeline, mitigation_strategies; scope (supplier_ids, country_codes), cascade |
| Sync / Compliance stubs | ✅ | GET /scss/sync/status, GET /scss/compliance/sanctions-status |

---

## Related Documents

- [SCSS_DETAILED_SPEC.md](SCSS_DETAILED_SPEC.md) — Детальный разбор задач, сценарии, ESG/sanctions, интеграции.
- [SCSS_PROFESSIONAL_SPEC.md](SCSS_PROFESSIONAL_SPEC.md) — Institutional-grade spec: 1000+ nodes, 5+ tiers, real-time, compliance, C-suite reporting.
- [SCSS_INSTITUTIONAL_ROADMAP.md](SCSS_INSTITUTIONAL_ROADMAP.md) — Gap analysis and phased roadmap (current MVP → institutional).
- [STRATEGIC_MODULES_ROADMAP.md](STRATEGIC_MODULES_ROADMAP.md) — Общая дорожная карта модулей (CIP, SCSS, SRO).
- [STRATEGIC_MODULES_PHASE1_SPEC.md](STRATEGIC_MODULES_PHASE1_SPEC.md) — FR-SCSS и общие требования Phase 1.
