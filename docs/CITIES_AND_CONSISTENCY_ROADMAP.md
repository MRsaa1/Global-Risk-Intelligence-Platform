# Cities & consistency roadmap

Modules and widgets that should use a single city/country context. Status: already bound vs next steps.

## Goal

One city/country selection should drive all metrics and widgets: risk, alerts, grants, CADAPT, Command Center, Municipal Dashboard, etc.

## Modules / widgets

| Module or widget | City/country source | Status |
|------------------|---------------------|--------|
| Municipal Dashboard (default community) | Selected community / Bastrop TX demo | ✅ Bound |
| Municipal Risk (AEL, 100-year, flood product) | Community/city from dashboard | ✅ Bound |
| Municipal Alerts (72h forecast) | Community | ✅ Bound |
| Municipal Grants, Commissions, Payouts | Municipality / community | ✅ Bound |
| CADAPT flood-risk-product, flood-scenarios | city= or lat/lon | ✅ Bound |
| CADAPT Engineering Solutions Matcher | Risk context from Municipal | ✅ Bound |
| Command Center (globe, H3, cascade) | Can be global or region; city filter optional | ⚠️ Partial |
| Dashboard today-card (climate, GDELT) | Distinct cities from DB; not single selector | 📋 Next: single context |
| Risk Zones Analysis | Region / portfolio; city filter | 📋 Next: align with city |
| Platform risk-posture, analytics | Portfolio/global; city filter | 📋 Next: optional city scope |
| Alerts (SENTINEL) | Source-based; no single city filter | 📋 Next: filter by city/region |
| Backtesting, stress tests | Scenario/portfolio; city in scenario params | 📋 Next: default from context |
| Country Risk | Country code | ✅ Bound |
| CityOS cities, forecast | City twin list; selection per module | 📋 Next: link to global selector |

## Next steps

- Introduce a **global city/country context** (e.g. store or URL) used by Dashboard, Command Center, and Analytics where applicable.
- Ensure **all Municipal widgets** read from the same community (already largely the case).
- Add **city/region filter** to Alerts and Risk Zones where relevant.
- Document in NOT_IMPLEMENTED that “full consistency” = this checklist completed.
