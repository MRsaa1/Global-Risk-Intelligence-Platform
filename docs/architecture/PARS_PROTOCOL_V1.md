# PARS Protocol v1.0 — Physical Asset Risk Schema

**Layer 5: Protocol.** Formal specification for physical-financial data exchange.

## Version

- **Schema version:** 1.0  
- **Document status:** Implemented  
- **JSON Schema:** `data/schemas/pars-asset-v1.json`  
- **$id:** `https://pars.standard.org/v1/asset.json`

## Purpose

PARS (Physical Asset Risk Schema) provides a machine-readable, versioned standard for:

- Identity of physical assets (buildings, infrastructure) with a canonical **PARS ID**
- Physical attributes (geometry, condition)
- Exposures (climate, infrastructure, risk scores)
- Financial linkage (valuation, currency)
- Provenance (sources, verifications)

It enables interoperability between the Global Risk Platform and external systems (regulators, insurers, data providers) and supports Layer 5 in the five-layer architecture.

## PARS ID Format

```
PARS-{REGION}-{COUNTRY}-{CITY}-{UNIQUE_ID}
```

- **REGION:** 2-letter region code (e.g. `EU`)
- **COUNTRY:** 2-letter ISO 3166-1 alpha-2 (e.g. `DE`, `ES`)
- **CITY:** 3–4 letter city/locality code (e.g. `MUC`, `BCN`)
- **UNIQUE_ID:** Alphanumeric unique identifier (e.g. `A1B2C3D4`)

Example: `PARS-EU-DE-MUC-1234`, `PARS-EU-ES-BCN-4782`.

## Schema Structure (Asset)

| Section     | Description |
|------------|-------------|
| `identity` | Required. `pars_id`, optional `legal_entity_id`, `external_ids` |
| `physical` | Geometry (e.g. Point), condition (year_built, construction_type) |
| `exposures`| Climate and infrastructure exposures; risk scores 0–100 |
| `financial`| Valuation (value, currency, as_of) |
| `provenance`| data_sources, verifications |

Full definition: see `data/schemas/pars-asset-v1.json` and API `GET /api/v1/pars/schema`.

## Platform Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/pars/export/assets` | Export assets in PARS v1 format (paginated: `limit`, `offset`) |
| GET | `/api/v1/pars/schema` | PARS Asset JSON Schema (v1) |
| GET | `/api/v1/pars/status` | Protocol version and export capability |

## Versioning

- **Schema version** is carried in the API response (`pars_version`, `x_pars_version` in schema).
- Future versions (e.g. v2) will use a distinct `$id` and optional new endpoints (e.g. `/api/v1/pars/v2/...`) with backward compatibility.

## References

- Layer 5 description: `docs/architecture/FIVE_LAYERS.md`
- Strategic modules and PARS: `docs/architecture/STRATEGIC_MODULES_V2_VISION.md`
- ISO alignment: `docs/architecture/PARS_ISO_ALIGNMENT.md`
