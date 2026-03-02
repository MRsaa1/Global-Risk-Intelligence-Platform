# Municipal climate risk disclosure — for insurers, reinsurers, regulators

**One-page summary:** Why a single format, how to get data from the platform, how you can use it.

## Why a single format?

- **Consistency:** Cities and sub-sovereigns disclose in the same structure; you ingest once.
- **Auditability:** Provenance (data_sources, updated_at, model_versions) supports due diligence and regulatory filing.
- **Interoperability:** Same schema for underwriting, regulatory submission, and internal risk systems.

## How to get data

- **API:** `GET /api/v1/cadapt/disclosure-export?city={municipality_id}&format=municipal_schema_v1`
- **Schema:** [docs/risk-disclosure-schema/](risk-disclosure-schema/SPEC.md) — JSON Schema, example, and field description.
- **License:** Open, royalty-free for use in your processes.

## How you can use it

- **Underwriting:** Use hazards, exposure (AEL, 100-year loss), and insurability block for pricing and terms.
- **Regulatory filing:** Use identity, exposure, governance, and provenance to meet disclosure requirements (e.g. TCFD-style, OSFI B-15).
- **Requiring from cities:** You can require municipalities to provide disclosure in this format (e.g. as part of grant or insurance conditions); the platform can generate it for them.

## Contact

For API access, bulk export, or schema extensions: use your platform contract or contact the platform operator.
