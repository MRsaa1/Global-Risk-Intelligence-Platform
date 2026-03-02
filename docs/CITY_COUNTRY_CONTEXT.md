# City and Country Context (Phase D)

**One selected city/country sets context for all widgets and endpoints.**

## Overview

Across the Municipal Dashboard, Command Center, and module UIs, a single **city** (or **country**) selection drives:

- CADAPT: risk, alerts, grants, commissions, payouts, flood product
- Map view: focus coordinates, layers, H3 risk
- Stress tests and digital twin: zone and portfolio context
- Country risk views: selected country code filters cities and metrics

## Identifiers

- **City:** `selectedCity` (e.g. `bastrop_tx`, `chicago_il`) — used in query params `?city=...` and in API requests. Same ID is used for `/cadapt/community/risk`, `/cadapt/flood-scenarios`, `/cadapt/applications?municipality=...` (municipality is city name derived from selectedCity).
- **Country:** `selectedMapCountryCode` or `selectedCountry` (ISO 2-letter, e.g. `US`, `DE`) — used for country risk, map city list, and filtering.

## Reference Data

- **Frontend:** `public/data/cities-by-country.json` — multiple cities per country; keyed by country code. Used for map city dropdown and context.
- **Backend:** Community/city lists may come from CADAPT `community/list`, geodata, or country_risk; same city IDs should be used where applicable.

## Metric Consistency

When the same city is selected:

- Risk score, population, and community name from `GET /api/v1/cadapt/community/risk?city=X` should match the context used in flood product, applications, and payouts for that city.
- Tests: `apps/api/tests/test_metric_consistency.py` — assert same city param yields consistent responses across CADAPT and related endpoints.

## Extending Cities/Countries

To add more cities or countries:

1. Extend `public/data/cities-by-country.json` (structure: `{ "CC": [ { "id", "name", "lat", "lng", "population" } ] }`).
2. Ensure backend community/risk and flood endpoints accept the same `city` IDs (or map them in the API).
3. Run `test_metric_consistency` to confirm responses stay consistent.
