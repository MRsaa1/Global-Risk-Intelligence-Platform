# City Risk Report — Target Structure (Complete Taxonomy)

This document defines how the **Unified Stress Report** (Full assessment by location) should look. It aligns with the **Complete City Risk Taxonomy & Methodology** (280 distinct risk factors). The report UI and API will be refined to match this structure.

---

## Report Sections (order)

1. **Overview** — Location, scope (country/city), report date, data freshness note.
2. **Executive summary** — 1–2 paragraphs; key findings and top risks.
3. **Risk by category** — One block per main category (see below), with subcategories and risk counts. Each risk factor can show: name, score, trend, data sources (when available).
4. **Stress test coverage** — Which platform scenarios (Current + Forecast) were included in this run.
5. **Historical comparison** — Similar past events, calibration.
6. **Methodology** — Short note + link to full methodology (data collection, scoring formula, validation).

---

## Category structure (280 risks total)

| # | Category | Risk count | Subcategories (examples) |
|---|----------|------------|----------------------------|
| 1 | Climate & Environmental | 42 | Sea Level & Coastal (8), Temperature & Heat (7), Air Quality (8), Water Resources (6), Extreme Weather (7), Precipitation (6) |
| 2 | Infrastructure & Utilities | 38 | Rail/Subway (8), Roads/Bridges (10), Water (8), Wastewater (4), Energy Grid (8) |
| 3 | Socio-Economic | 35 | Housing (9), Income & Wealth (8), Employment (6), Education (7), Population (5) |
| 4 | Public Health & Safety | 32 | Healthcare Access (8), Disease & Illness (10), Mental Health (5), Crime & Safety (9) |
| 5 | Financial & Economic | 28 | Municipal Finance (10), Real Estate (8), Business Climate (6), Tourism & Convention (4) |
| 6 | Technology & Cyber | 25 | Cybersecurity (12), Digital Infrastructure (8), AI & Automation (5) |
| 7 | Political & Regulatory | 18 | Governance (8), Regulatory Compliance (6), Political Stability (4) |
| 8 | Transportation & Mobility | 22 | Traffic & Congestion (8), Transit (8), Active Transportation (3), Parking (3) |
| 9 | Energy & Resources | 25 | Natural Gas (5), Water expanded (6), Waste & Recycling (8), Circular Economy (6) |
| — | Cross-cutting | 15 | Cascading Failures (3), Emerging Tech (3), Social Cohesion (3), Legal & Liability (3), Resilience (3) |

**Total: 280 distinct risk factors.**

---

## Methodology (summary for report)

- **Risk score** = Probability × Impact × Urgency × Confidence
- **Data layers**: Satellite, IoT sensors, government APIs, social/crowdsource, private data
- **Processing**: ETL → validation → analytics/ML → risk scoring
- Full details: see Complete City Risk Taxonomy & Methodology doc (data sources, calculation examples, validation, backtesting).

---

## Implementation notes

- Report page shows **skeleton by category** even when API returns placeholder; real scores will populate as data/APIs are connected.
- Each category block can be expandable (accordion) with subcategories and, later, per-risk rows (name, score, trend).
- Backend `POST /api/v1/unified-stress/run` can later return `category_scores` and `top_risks` aligned to this taxonomy.
