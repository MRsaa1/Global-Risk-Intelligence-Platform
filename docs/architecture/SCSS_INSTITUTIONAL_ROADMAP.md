# SCSS: Current State → Institutional Grade (Roadmap)

Gap analysis and phased path from current SCSS MVP to the [Professional-Grade Spec](SCSS_PROFESSIONAL_SPEC.md).

---

## Gap Overview

| Dimension | Current (MVP) | Institutional target |
|-----------|----------------|----------------------|
| **Scale** | Tens of suppliers, single DB | 1000+ nodes, graph DB (Neo4j) or scaled SQL |
| **Tiers** | 0–5 (BFS from root) | 5+ tiers, full raw→consumer |
| **Real-time** | Manual refresh, no ERP | ERP/PLM sync every 15 min |
| **Views** | Force graph + summary text | Network + Sankey + Geographic map |
| **Filters** | None on map | Tiers, Risk, Geography, Category |
| **Metrics** | Nodes/edges, by country/tier | SPOF, bottlenecks, lead time, resilience, geo % |
| **Simulation** | Single-run (trade_war/sanctions/disaster) | Multi-parameter, timeline, mitigation ROI |
| **Compliance** | None | Sanctions screening, audit trail, ESG |
| **Reporting** | None | Executive summary, board-ready PDF |

---

## Phase 1: Professional UI (Current Codebase)

**Goal:** Make the existing Chain Map look and behave like the institutional Main View, using current API only.

- [x] Interactive force-directed graph (nodes/edges, risk coloring)
- [x] **Filters:** Tiers (All, T0–T5), Risk (All, Critical, High, Medium, Low), Geography (All + countries from data), Category (All + supplier_type)
- [x] **Legend:** 🔴 Critical / 🟡 Medium / 🟢 Low; direct vs indirect (optional)
- [x] **Metrics panel:** Total suppliers, Critical bottlenecks count, SPOF count, Avg lead time (if API provides), Resilience placeholder, Geographic distribution (e.g. USA 45%, …)
- [x] View toggle [Graph | Sankey | Map] with Sankey stub and Map stub

**Deliverable:** One “Supply Chain Map” card with filters, graph, legend, metrics; no backend change.

---

## Phase 2: Data & Scale (Backend)

**Goal:** Support larger graphs and richer node/edge attributes.

- [x] Extend `chain/map`: `lead_time_days` per node (from supplier); `single_points_of_failure: string[]`, `critical_bottlenecks_count: number`, `resilience_score` (0–1 from diversification + geographic spread) in response
- [x] Frontend metrics panel: SPOF count, Critical bottlenecks, Resilience score from chain response
- [x] Optional `max_nodes` on chain/map to cap graph size (backend)

**Deliverable:** Chain map response powers metrics panel; resilience and SPOF from same request.

---

## Phase 3: Sankey + Geographic Map

**Goal:** Two additional views as in the spec.

- [x] **Sankey:** D3 (@plotly/d3-sankey); columns = tier (T0 → T1 → …); link width = transit_time_days or 1; node color = risk (green/yellow/red); critical = yellow ring; view toggle [Network | Sankey]
- [x] **Geographic view:** Map (Deck.gl + Mapbox); ScatterplotLayer by supplier location; color by risk (green/amber/red); fallback to country centroid when no lat/lon; legend; without token shows “Suppliers by country” list
- [x] View toggle in Chain Map: [Network | Sankey | Map]

**Deliverable:** Users can switch between Network, Sankey, and Map for the same chain. Backend chain/map returns latitude/longitude when available.

---

## Phase 4: Simulation & Scenarios

**Goal:** Align with institutional scenario simulator.

- [x] Backend: `POST /scss/simulate` accepts `supplier_ids`, `country_codes[]`, `cascade`; returns `timeline: { month, capacity_pct }[]`, `mitigation_strategies: { name, cost_usd, impact_reduction_pct, roi }[]`
- [x] Scenario builder UI: country code(s) (comma-separated), cascade checkbox; severity 1–10 for disaster
- [x] Results: timeline bar chart (capacity % by month), mitigation strategies list with cost and ROI
- [x] Export report (download JSON/text summary); Create action plan (button links to recovery_plan / BCP)

**Deliverable:** War-gaming with timeline, mitigation strategies, and export/action plan actions.

---

## Phase 5: Real-Time & Integrations

**Goal:** Data freshness and ERP/PLM integration.

- [x] GET `/scss/sync/status` — status, last_refresh, adapter_type, next_scheduled
- [x] GET/PUT `/scss/sync/config` — adapter (manual/sap/oracle/edi), cron, webhook, is_enabled
- [x] POST `/scss/sync/run` — trigger sync; change detection; data quality; import audit
- [x] GET `/scss/sync/runs`, GET `/scss/sync/runs/{id}/audit` — runs and per-run audit
- [x] Adapters: SAP/Oracle/EDI stubs (plug real connectors when in scope)

**Deliverable:** Configurable sync, change detection, data quality, import audit.

---

## Phase 6: Compliance & Reporting

**Goal:** Audit trail and C-suite reporting.

- [x] GET `/scss/compliance/sanctions-status` — last_scan, matches, pending_review
- [x] POST `/scss/compliance/sanctions-scan` — screen suppliers (stub OFAC/EU; plug real API when required)
- [x] GET/PATCH `/scss/compliance/sanctions-matches` — match review (reviewed/cleared); audit trail: GET `/scss/audit`
- [x] Executive report: GET `/scss/reports/executive/data` (JSON), GET `/scss/reports/executive` (PDF); present_url for Present to board

**Deliverable:** Sanctions screening (stub + match review), audit trail, executive PDF and Present link.

---

## Implementation Order (Suggested)

1. **Phase 1** (Professional UI) — immediate; no new backend.
2. **Phase 2** (Data & scale) — when metrics and Sankey data are required.
3. **Phase 3** (Sankey + Map) — when users need flow and geography views.
4. **Phase 4** (Simulation) — when war-gaming and ROI are priority.
5. **Phase 5** (Real-time) — when ERP/PLM integration is in scope.
6. **Phase 6** (Compliance & reporting) — when regulators or board need audit and reports.

---

## Links

- [SCSS_PROFESSIONAL_SPEC.md](SCSS_PROFESSIONAL_SPEC.md) — Full institutional spec
- [SCSS_IMPLEMENTATION_PLAN.md](SCSS_IMPLEMENTATION_PLAN.md) — FR list and backend status
- [STRATEGIC_MODULES_ROADMAP.md](STRATEGIC_MODULES_ROADMAP.md) — Platform roadmap
