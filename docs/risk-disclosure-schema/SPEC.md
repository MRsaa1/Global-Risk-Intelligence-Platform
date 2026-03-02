# Municipal / sub-sovereign climate risk disclosure schema (v1)

**Purpose:** De facto standard format for disclosing municipal climate risk to insurers, reinsurers, and regulators. Royalty-free, open for partner use.

## Fields

| Section | Description |
|--------|-------------|
| **identity** | Municipality id, name, reporting period, schema version |
| **hazards** | Hazard types (flood, heat, etc.) with score, level, data source |
| **exposure** | AEL (annual expected loss), 100-year loss, projected 2050 (when available) |
| **governance** | Frameworks (e.g. MUNICIPAL_INSURABILITY, TCFD), section count |
| **provenance** | data_sources, updated_at, model_versions for audit |
| **insurability** | Availability, premium impact (optional) |
| **roi_evidence** | Loss reduction, reaction time, insurance impact (optional) |

## API

- **GET** `/api/v1/cadapt/disclosure-export?city={municipality_id}&format=municipal_schema_v1`

Returns the disclosure payload in this schema. Use for underwriting, regulatory filing, or internal risk systems.

## Versioning

- **v1:** Current. Identity, hazards, exposure, governance, provenance; optional insurability and roi_evidence.
- Future v2 may add stress test results, adaptation measures, or jurisdiction-specific extensions.

## Relation to PARS

This schema is a **public subset** of platform-internal PARS and disclosure packages. See [PARS_ISO_ALIGNMENT.md](../architecture/PARS_ISO_ALIGNMENT.md) for alignment with ISO and internal formats.
