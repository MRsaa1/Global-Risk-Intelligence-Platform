# PARS Alignment with ISO Standards

**Document purpose:** Map PARS Protocol v1 to relevant ISO standards for risk and assets; checklist of what is covered by the platform and what is in progress.

**PARS version:** 1.0  
**Last updated:** 2026-02-18  

---

## Relevant ISO Standards (Reference)

| Standard | Scope | Relevance to PARS |
|----------|--------|-------------------|
| **ISO 31000** | Risk management — principles and guidelines | Risk identification, assessment; exposure and risk metrics in PARS |
| **ISO 14001** | Environmental management | Environmental / climate exposure in PARS (exposures.climate) |
| **ISO 55000** | Asset management | Asset identity, condition, valuation; physical and financial linkage |
| **ISO 19650** | BIM / information management (construction) | Physical asset data, BIM references (platform-specific extensions) |
| **ISO 3166-1** | Country/region codes | PARS ID uses ISO 3166-1 alpha-2 for country (e.g. DE, ES) |
| **ISO 4217** | Currency codes | Financial.valuation.currency (e.g. EUR, USD) |

*Note: There is no single “ISO XXXXX” that defines “physical asset risk schema” as such; the above are the most relevant for identity, risk, assets, and environment.*

---

## Checklist: Platform Coverage vs ISO Alignment

### Identity and classification

| Requirement | ISO / best practice | Platform status |
|-------------|---------------------|-----------------|
| Unique asset identifier | ISO 55000 (asset identity) | **Covered:** PARS ID (e.g. PARS-EU-DE-MUC-xxx) |
| Country/region codes | ISO 3166-1 | **Covered:** country_code in asset and PARS ID |
| Asset type / classification | Common practice | **Covered:** asset_type in Layer 1 and PARS export |

### Risk and exposure

| Requirement | ISO 31000 / 14001 | Platform status |
|-------------|-------------------|-----------------|
| Risk metrics (scores) | Risk assessment | **Covered:** climate_risk_score, physical_risk_score, network_risk_score in PARS exposures |
| Environmental / climate exposure | ISO 14001, TCFD-style | **Covered:** exposures.climate in schema; platform computes climate risk |
| Traceability of risk data | Provenance | **In progress:** provenance section in schema; full verification pipeline in development |

### Financial linkage

| Requirement | ISO 55000, reporting | Platform status |
|-------------|----------------------|-----------------|
| Valuation and currency | ISO 4217 | **Covered:** financial.valuation (value, currency, as_of) |
| Link to financial products | Regulatory reporting | **Covered:** platform has financial_product, insurance_product_type; PARS can be extended for product IDs |

### Geometry and physical

| Requirement | ISO 19650, spatial | Platform status |
|-------------|---------------------|-----------------|
| Location (coordinates) | Common practice | **Covered:** physical.geometry (Point) in PARS |
| Condition / age | Asset management | **Covered:** year_built, year_renovated, construction_type |

### Provenance and verification

| Requirement | ISO 27001, audit | Platform status |
|-------------|-------------------|-----------------|
| Data sources | Audit trail | **In progress:** provenance.data_sources in schema; Layer 0 provenance in platform |
| Verifications | Integrity | **In progress:** provenance.verifications; verification status in Layer 0 |

---

## Summary

- **Already covered by platform:** Asset identity (PARS ID), country/currency codes (ISO 3166-1, 4217), risk and exposure metrics, valuation, geometry and condition, basic provenance structure in schema.
- **In progress:** Full provenance and verification pipeline, extended regulatory reporting fields, and optional alignment with specific ISO certification (e.g. ISO 31000 risk process documentation).

**Remaining to complete alignment:**

- **Provenance pipeline:** End-to-end population of `provenance.data_sources` and `provenance.verifications` in PARS export from platform Layer 0 / ingestion metadata; where data is already available, fill in export; where not, document as next step.
- **Verification status in Layer 0:** Explicit verification status field and workflow (e.g. verified / pending / failed) in Layer 0 and in PARS export.
- **Optional — ISO 31000 process:** Documented risk process (identification, assessment, treatment) aligned to ISO 31000 for certification or regulator engagement; optional profile in PARS.

Future versions of PARS can add optional fields or profiles that explicitly reference ISO 31000, ISO 55000, or ISO 14001 where needed for certification or regulator engagement.

---

## Municipal risk disclosure schema (public)

A **public, de facto standard** format for municipal / sub-sovereign climate risk disclosure is published for partners (insurers, reinsurers, regulators):

- **Schema & spec:** [docs/risk-disclosure-schema/](../../risk-disclosure-schema/SPEC.md) — JSON Schema (schema-v1.json), example payload, and short specification.
- **API:** `GET /api/v1/cadapt/disclosure-export?city={municipality_id}&format=municipal_schema_v1` returns disclosure in this format.
- **Content:** Identity (municipality, period), hazards (types, scores, sources), exposure (AEL, 100y, valuation), governance/compliance (frameworks, sections), provenance (data_sources, updated_at). Optional: insurability, roi_evidence.

This schema is a **subset** of platform PARS and disclosure packages: the minimum needed for partners to consume municipal climate risk data without platform-specific details. Full PARS export remains available for internal and advanced use.
