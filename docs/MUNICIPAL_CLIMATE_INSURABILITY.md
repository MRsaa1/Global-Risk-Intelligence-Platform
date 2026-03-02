# Municipal Climate Insurability Report

## Purpose

The **Municipal Climate Insurability Report** is a single artifact that links climate risk, exposure, and insurability for a municipality (city/region). It is intended for:

- **Municipalities:** Document risk and adaptation status for grant applications, insurer negotiations, and board reporting.
- **Insurers/Reinsurers:** Assess sub-sovereign climate exposure and underwriting conditions.
- **Regulators:** Review climate risk disclosure in line with TCFD, OSFI B-15, EBA and similar frameworks.

## Structure

The report includes:

1. **Hazards** — Risk scores by type (flood, heat, drought, wildfire, etc.) with level (low/medium/high) and data source.
2. **Exposure** — Financial exposure: annual expected loss (AEL), 100-year loss, projected 2050 values.
3. **Insurability** — Availability (standard/limited/restricted), premium impact score, estimated baseline premium, recommendations.
4. **Compliance** — Summary of disclosure package (TCFD, OSFI B-15, EBA) with compliance score and chain integrity.
5. **Audit trail** — Who generated, when, model versions, and data sources for reproducibility.

## API

- **GET** `/api/v1/cadapt/insurability-report?city={municipality_id}&period={period}&format=json|pdf`
  - `city`: Municipality ID (e.g. `bastrop_tx`, `DE-2950159`). Default: `bastrop_tx`.
  - `period`: Reporting period (e.g. `2026-01-01 to 2026-12-31`). Default: current year.
  - `format`: `json` (default) or `pdf`.

## Reading the audit trail

Each report includes an `audit_trail` array with entries:

- `timestamp`: ISO 8601 generation time.
- `action`: `generate_insurability_report`.
- `actor`: User or system identifier.
- `municipality_id`: Municipality for which the report was generated.
- `model_versions`: Versions of risk, climate, and financial models used.

`model_versions` and `data_sources` enable reproducibility: the same inputs produce the same report structure.

## Link to regulatory frameworks

The report references the **MUNICIPAL_INSURABILITY** framework in the platform’s regulatory templates:

- Governance
- Exposure & Stress Scenarios
- Disclosure

These align with TCFD-style pillars (governance, strategy, risk management, metrics) and can be exported as part of disclosure packages (TCFD, OSFI B-15, EBA) for compliance reporting.

## References

- Service: `apps/api/src/services/municipal_insurability_report.py`
- Endpoint: `apps/api/src/api/v1/endpoints/cadapt.py` (`/insurability-report`)
- Templates: `apps/api/src/core/regulatory_document_templates.py` (`MUNICIPAL_INSURABILITY`)
- Audit: `apps/api/src/services/audit_extension.py` (`REGULATORY_FRAMEWORKS.MUNICIPAL_INSURABILITY`)
