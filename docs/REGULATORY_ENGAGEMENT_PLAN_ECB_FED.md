# Regulatory Engagement Plan: ECB and Fed

Brief plan for engagement with **ECB** (EU) and **Federal Reserve** (US) on stress testing and disclosures, plus a requirements checklist and mapping of platform outputs (FST, SRO) to that checklist.

---

## 1. Engagement plan (ECB and Fed)

| Stage | ECB (EBA/SSM) | Fed (DFAST/CCAR) | Artifacts |
|-------|----------------|------------------|-----------|
| **Who** | ECB Banking Supervision, EBA (stress tests, climate) | Federal Reserve Board (Dodd–Frank stress testing, CCAR) | Point-of-contact, submission deadlines |
| **Scoping** | EBA/ECB stress test templates; climate (EBA Guidelines, NGFS) | DFAST scenarios (supervisory + baseline); CCAR capital plan | List of required templates and scenarios |
| **Data & models** | EU-wide stress test data; internal models vs. supervisory | FR Y-14, capital and loss projections; model documentation | Data dictionary, model inventory |
| **Submission** | EBA CROE / national competent authority channels | Fed submission portal (CCAR, DFAST) | Submission package (tables, narratives) |
| **Follow-up** | Feedback, thematic reviews, climate stress | Qualitative objection, capital plan resubmission | Response to feedback, remediation plan |

Platform role: produce **regulatory-ready structures** (EBA CROE, Fed DFAST/CCAR) from stress test runs and map report sections to checklist items (see below). Final submission remains institution-owned and subject to internal review.

---

## 2. Requirements checklist (stress tests and disclosures)

Table: requirement | source | platform coverage | where in code/report.

| # | Requirement | Source | Platform coverage | Where in code / report |
|---|-------------|--------|--------------------|-------------------------|
| 1 | Stress test scenario definition (scenario id, name, horizon) | ECB/EBA, Fed DFAST | Yes | FST `report.sections.scenario_description`, `regulatory_formatters` |
| 2 | Total impact / loss (currency, magnitude) | ECB/EBA CROE, Fed DFAST | Yes | `regulatory_formatters.format_eba_croe`, `format_fed_dfast_ccar`; FST `report.sections.financial_impact` |
| 3 | Impact breakdown by sector / exposure class | EBA CROE, Fed | Partial | `format_eba_croe` sections CROE_STRESS impact_breakdown; FST can pass sector_metrics |
| 4 | Climate / ESG scenario analysis (EBA) | EBA Guidelines, ECB climate stress | Yes | `format_eba_croe` CROE_CLIMATE; FST scenario `regulatory_format=ecb`; OSFI_EBA_CLIMATE_CHECKLIST |
| 5 | Capital impact (CET1, Tier1, ratios) | Basel, Fed CCAR | Partial | `format_fed_dfast_ccar` capital_impact; `format_basel_pillar3` OV/LIQ; basel_calculator |
| 6 | Pre-provision loss (Fed DFAST/CCAR) | Fed | Yes | `format_fed_dfast_ccar` pre_tax_pre_provision_loss_impact_usd_m |
| 7 | Liquidity (LCR, NSFR) | Basel Pillar 3, EBA | Partial | `format_basel_pillar3` LIQ; basel_calculator when available |
| 8 | Disclosure narrative / governance (EBA/ECB) | EBA, ECB SSM | Partial | Audit Extension disclosure packages; EBA section in OSFI_EBA_CLIMATE_CHECKLIST |
| 9 | Submission-ready template structure | EBA CROE, Fed DFAST/CCAR | Yes | `regulatory_formatters.py`; FST run returns `regulatory_package` (see below) |

See also: [OSFI_EBA_CLIMATE_CHECKLIST.md](OSFI_EBA_CLIMATE_CHECKLIST.md) (OSFI B-15, EBA climate, TCFD-aligned).

---

## 3. FST and SRO report mapping to checklist

### 3.1 FST run response and `regulatory_package`

- **FST run** (`POST /api/v1/fst/run` or module equivalent) returns:
  - `report`: scenario_id, scenario_name, regulatory_format (basel | fed | ecb), sections (executive_summary, scenario_description, physical_shock, financial_impact, capital_impact, recommendations).
  - **`regulatory_package`**: structure produced by `regulatory_formatters` for the chosen format:
    - **ecb** → EBA CROE (`format_eba_croe`) — CROE_STRESS, CROE_CLIMATE, report metadata.
    - **fed** → Fed DFAST/CCAR (`format_fed_dfast_ccar`) — scenario, pre-provision loss, capital_impact.
    - **basel** → Basel Pillar 3 (`format_basel_pillar3`) — OV, CRE, LIQ tables when calculator available.

- **Checklist mapping (FST):**
  - §1 Scenario definition → `report.sections.scenario_description`, `regulatory_package.reporting_period` / `scenario`.
  - §2 Total impact → `regulatory_package` sections (e.g. total_impact_eur_m, pre_tax_pre_provision_loss_impact_usd_m).
  - §3 Impact breakdown → `regulatory_package.sections.CROE_STRESS.impact_breakdown` (EBA) or equivalent.
  - §4 Climate → `regulatory_package.sections.CROE_CLIMATE` (ecb); FST scenario with `regulatory_format=ecb`.
  - §5–7 Capital / liquidity → `regulatory_package` capital_impact, tables OV/LIQ (basel/fed).
  - §6 Pre-provision loss → `regulatory_package.pre_tax_pre_provision_loss_impact_usd_m` (fed).
  - §9 Template structure → entire `regulatory_package` (template id, sections, disclaimer).

### 3.2 SRO report endpoints

- If SRO exposes report endpoints (e.g. contagion / system-wide stress), align output with the same checklist:
  - Provide scenario identifier, total/system impact, and (where applicable) sector/entity breakdown.
  - Map SRO report sections to checklist §1–3 and §9; capital/liquidity (§5–7) if SRO output includes them or is combined with FST/Basel.

---

## 4. Code references

- **Regulatory formatters (EBA CROE, Fed DFAST/CCAR, Basel Pillar 3):** `apps/api/src/services/regulatory_formatters.py` — `format_eba_croe`, `format_fed_dfast_ccar`, `format_basel_pillar3`, `format_for_regulator`.
- **FST service (run response, regulatory_format):** `apps/api/src/modules/fst/service.py` — `run_scenario()` builds `report` and (after update) `regulatory_package` via formatters.
- **Compliance / export:** `apps/api/src/api/v1/endpoints/compliance.py` — regulatory export; `audit_ext.py` — disclosure packages.
- **Checklist (OSFI, EBA climate):** `docs/OSFI_EBA_CLIMATE_CHECKLIST.md`.

---

**Status:** Plan and checklist in place; FST run returns `regulatory_package`; SRO alignment when report endpoints exist.  
**Last updated:** 2026-02-18
