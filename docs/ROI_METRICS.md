# ROI Metrics — Three Provable Metrics

## Purpose

Three metrics that are hard to ignore for commercial and regulatory materials:

1. **Loss reduction** — Estimated loss avoided (12 months) from adaptation measures
2. **Reaction time reduction** — Median time from alert/event to first action (hours)
3. **Insurance / cost of capital impact** — Premium impact score, availability

## Definitions

### 1. Loss reduction (loss_reduction_12m)

- **Unit:** USD (or EUR)
- **Meaning:** Estimated loss avoided over 12 months by implementing recommended adaptation measures
- **Calculation:** AEL (annual expected loss) × combined effectiveness of top recommended measures × period factor
- **Data sources:** Community risk (financial_exposure), CADAPT recommend_measures (effectiveness_pct)
- **Interpretation:** Higher value = more value from adaptation investment

### 2. Reaction time (reaction_time_median_hours)

- **Unit:** Hours
- **Meaning:** Median time from alert/event detection to first documented action
- **Calculation:** From agent_audit_log (oversee, agentic_orchestrator, arin) timestamps; when no data, uses demo default
- **Data sources:** Agent audit log, alert resolution events
- **Interpretation:** Lower = faster response; target &lt; 4h for critical events

### 3. Insurance / cost of capital impact (insurance_impact_score)

- **Unit:** 0–1 (or percentage)
- **Meaning:** Indicator of how risk affects insurance availability and premium
- **Calculation:** Composite of hazard scores (flood, heat, etc.) normalized to 0–1
- **Data sources:** Community risk hazards, insurance_scoring, financial_models
- **Interpretation:** Lower = better conditions; higher = restricted availability, higher premiums

## API

- **GET** `/api/v1/cadapt/roi-metrics?city={municipality_id}&period=12m|6m`

Response includes all three metrics plus `calculated_at`, `period`, `sources`.

## Use in reports and dashboard

- **Municipal Climate Insurability Report:** Includes `roi_evidence` block with the three metrics
- **Municipal Dashboard:** ROI evidence block shows the three metrics with brief labels

## References

- Service: `apps/api/src/services/municipal_roi_metrics.py`
- Endpoint: `apps/api/src/api/v1/endpoints/cadapt.py` (`/roi-metrics`)
- Insurability report: `apps/api/src/services/municipal_insurability_report.py` (roi_evidence)
