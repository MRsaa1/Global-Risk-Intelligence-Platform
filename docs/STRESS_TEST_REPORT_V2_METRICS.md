# Stress Test Report V2 — Who Generates What

This document maps each metric category to **who** generates it (service/module) and **how** (API, LLM, Monte Carlo, external data). It defines the target schema for Report 2.0 and how to fill it per stress test, city/region, and enterprise.

## Data accuracy and actuality

- **Current state:** Report V2 metrics are **indicative**, not fully validated. They are produced by the `stress_report_metrics` service using **scaled/placeholder** logic (e.g. VaR/CVaR from total loss × factors, temporal from event type defaults, contagion from loss scaling). They are **not** yet from real Monte Carlo runs, live cascade/graph analysis, or external feeds (weather, sensors).
- **Actuality:** Inputs (total loss, zones, city, event type, severity) are from the last stress test run; the V2 block is generated at report time. So the block is as current as the underlying run.
- **Accuracy:** Until real engines are wired (Monte Carlo, cascade, historical backtesting, data quality scores from pipelines), treat all V2 figures as **indicative** and use them for relative comparison and structure, not as standalone audit-grade numbers.
- **Improvement path:** See “Who generates what” below and the implementation checklist; plug in Monte Carlo, cascade, and data pipelines to increase accuracy.

---

## 1. Probabilistic Metrics (VaR, CVaR, Loss Distribution)

| Metric | Who generates | How |
|--------|----------------|-----|
| Mean (μ), Median | **Backend: `stress_report_metrics`** | Derived from `total_loss` (point estimate). Mean = total_loss; Median = total_loss × 0.78 (configurable). |
| VaR 95%, VaR 99% | **Backend: Monte Carlo service** (future: `financial_models.monte_carlo_stress`) or **`stress_report_metrics`** | Today: scaling from total_loss (e.g. VaR99 = total_loss × 1.55). Target: 10k+ simulations, copula. |
| CVaR / TVaR 99% | Same as VaR | Today: total_loss × 1.85. Target: average loss beyond VaR from MC. |
| Std dev (σ), Confidence Interval | **Monte Carlo service** or **`stress_report_metrics`** | Today: σ = total_loss × 0.25, CI = [total_loss × 0.65, total_loss × 1.65]. Target: from MC distribution. |
| Loss Exceedance Curve (EP curve) | **Monte Carlo service** | Array of (probability, loss) from MC. Not yet implemented. |

**Output:** `report_v2.probabilistic_metrics` (see schema below).  
**Per city/region:** Same formula; inputs are that run’s `total_loss` and optional local volatility.  
**Per enterprise:** When stress test is scoped to a portfolio/entity, run MC with entity exposure and correlation; same schema.

---

## 2. Temporal Dynamics (RTO, RPO, Impact Timeline)

| Metric | Who generates | How |
|--------|----------------|-----|
| RTO, RPO | **Backend: `stress_report_metrics`** (defaults) or **LLM** | Defaults by event type (e.g. flood: RTO 72h, RPO 24h). Optional: LLM from scenario description. |
| Time to Full Recovery | **`stress_report_metrics`** or **historical_events** | Default 6–18 months from event type. Can use median recovery from comparable historical events. |
| Business Interruption Duration | Same | Default e.g. 45 days; override from historical comparables. |
| Impact Timeline (T+0, T+24h, …) | **`stress_report_metrics`** | Staged percentages of total_loss (e.g. T+0: 17%, T+24h: 33%, T+1w: 67%, T+1m: 100%). |
| Loss Accumulation Curve | Same | Day 1, Week 1, Month 1, Quarter 1 amounts derived from timeline and total_loss. |

**Output:** `report_v2.temporal_dynamics`.  
**Per city/region:** Same logic; duration can depend on region (e.g. from historical events).  
**Per enterprise:** RTO/RPO from BCP or config; timeline from sector defaults.

---

## 3. Financial Contagion (Cross-Sector Impact)

| Metric | Who generates | How |
|--------|----------------|-----|
| Banking (NPL, provisions, CET1) | **Backend: `stress_report_metrics`** or **financial_models** | Today: placeholders (e.g. NPL +2.3%, CET1 -45bps) from total_loss scaling. Target: credit/financial model. |
| Insurance (claims, reinsurance, solvency) | Same | Placeholders: claims = f(total_loss), net retained, solvency impact. |
| Real Estate (value decline, vacancy) | Same | Placeholders: e.g. -18% value, +8% vacancy from total_loss. |
| Supply chain / GDP / jobs | Same | Placeholders: direct/indirect GDP %, job losses, trade disruption from total_loss. |

**Output:** `report_v2.financial_contagion`.  
**Per city/region:** Same structure; numbers can be regional multipliers.  
**Per enterprise:** When exposure is known, allocate contagion to entity (e.g. bank’s share of NPL increase).

---

## 4. Predictive / Early Warning Indicators

| Metric | Who generates | How |
|--------|----------------|-----|
| Leading indicators (river level, soil saturation, etc.) | **External data + API** (e.g. sensors, weather) or **LLM** | Future: integrate IoT/weather APIs. Today: placeholder text or LLM-generated “typical” triggers. |
| Trigger thresholds (AMBER, RED, BLACK) | **Backend: `stress_report_metrics`** or config | Default thresholds by event type (e.g. flood: level > 4.5m → AMBER). |
| P(Event \| conditions), P(Severity > x), P(Loss > x) | **Monte Carlo / Bayesian** or placeholder | Today: single probability from severity; target: model or MC. |
| Real-time monitoring dashboard link | **Frontend / config** | URL or “Dashboard” link; no generator. |

**Output:** `report_v2.predictive_indicators`.  
**Per city/region:** Thresholds and indicators can be region-specific (e.g. from geodata).  
**Per enterprise:** Same; enterprise may have own thresholds.

---

## 5. Network / Systemic Risk Metrics

| Metric | Who generates | How |
|--------|----------------|-----|
| Centrality, Betweenness, Clustering | **Cascade / graph service** (e.g. knowledge_graph, cascade) | From infrastructure graph; already partially in CascadeVisualizer. Expose in API. |
| Cascade path, amplification factor | **Cascade simulation** | From existing cascade run; add to report payload. |
| Single points of failure | **Graph analysis** or **`stress_report_metrics`** | List of critical nodes; from graph or placeholder. |
| Contagion velocity | **Cascade** or placeholder | Time between hops; from simulation or default. |

**Output:** `report_v2.network_risk`.  
**Per city/region:** Graph and cascade are city/region-specific.  
**Per enterprise:** Subgraph for entity’s dependencies.

---

## 6. Scenario Comparison & Sensitivity

| Metric | Who generates | How |
|--------|----------------|-----|
| Parameter sensitivity (+20% depth, +48h duration) | **Backend: `stress_report_metrics`** or sensitivity runs | Today: scaling factors (e.g. +20% depth → +12.6% loss). Target: multiple runs. |
| Multi-scenario table (10y, 50y, 100y, 200y) | **`stress_report_metrics`** | Table of return period vs probability, loss, buildings, recovery; from total_loss and event type. |

**Output:** `report_v2.sensitivity` and `report_v2.multi_scenario_table`.  
**Per city/region:** Same; inputs from this run.  
**Per enterprise:** Sensitivity on entity exposure.

---

## 7. Stakeholder-Specific Impacts

| Metric | Who generates | How |
|--------|----------------|-----|
| Residential (households, displacement, uninsured) | **`stress_report_metrics`** or **LLM** | Defaults: e.g. 8,500 households, 45 days, uninsured % from total_loss. |
| Commercial/Industrial | Same | Businesses interrupted, downtime, supply chain multiplier. |
| Government/Public | Same | Emergency cost, infrastructure repair, tax revenue loss. |
| Financial sector | Same | Loan defaults, claims, capital impact (align with financial_contagion). |

**Output:** `report_v2.stakeholder_impacts`.  
**Per city/region:** Population and sector mix from geodata/census.  
**Per enterprise:** One stakeholder type per report when scoped to entity.

---

## 8. Model Uncertainty & Validation

| Metric | Who generates | How |
|--------|----------------|-----|
| Data quality score (exposure, valuations, vulnerability) | **Backend: `stress_report_metrics`** or data pipeline | Scores 0–100% from metadata (e.g. building data 85%, valuations 70%). |
| Model limitations (caveats) | **Config or LLM** | Fixed list per model or short LLM summary. |
| Uncertainty decomposition (hazard, exposure, vulnerability) | **`stress_report_metrics`** | e.g. ±25%, ±15%, ±30%; combined ±45%. |
| Backtesting (predicted vs actual) | **historical_events + calculator** | Compare past events’ predicted vs actual loss; return list of backtests. |

**Output:** `report_v2.model_uncertainty`.  
**Per city/region:** Data quality can vary by region.  
**Per enterprise:** N/A or entity-specific data quality.

---

## 9. Where It All Lives in the Stack

| Layer | Responsibility |
|-------|----------------|
| **API** (`stress_tests.py`, report generation) | Calls `stress_report_metrics.compute_report_v2(...)` with test result (total_loss, zones, city_name, event_type, severity). Returns `report_v2` in response and/or stores in `report_data` JSON. |
| **Service** `stress_report_metrics.py` | Single place that produces all V2 sections: probabilistic, temporal, financial_contagion, predictive, network (or stub), sensitivity, stakeholder, model_uncertainty. Uses placeholders/scaling where real engines are missing. |
| **Monte Carlo / financial_models** (future) | Replace placeholder VaR/CVaR and loss distribution with real simulations. |
| **Cascade / graph** | Feed network_risk (centrality, paths, SPOF). |
| **Historical events API** | Feed backtesting and, optionally, recovery duration and stakeholder defaults. |
| **Frontend** (`StressTestReportContent`) | Renders `report_v2` sections when present; falls back to existing summary/VaR/Cascade blocks. |

---

## 10. Report V2 Schema (JSON)

```json
{
  "report_v2": {
    "probabilistic_metrics": {
      "mean_loss": 2700,
      "median_loss": 2100,
      "var_95": 4200,
      "var_99": 5800,
      "cvar_99": 6900,
      "std_dev": 1400,
      "confidence_interval_90": [1800, 4500],
      "monte_carlo_runs": 10000
    },
    "temporal_dynamics": {
      "rto_hours": 72,
      "rpo_hours": 24,
      "recovery_time_months": [6, 18],
      "business_interruption_days": 45,
      "impact_timeline": [
        { "label": "T+0h", "loss_share": 0.17, "description": "Immediate impact" },
        { "label": "T+24h", "loss_share": 0.33, "description": "Emergency response" },
        { "label": "T+1w", "loss_share": 0.67, "description": "Short-term stabilization" },
        { "label": "T+1m", "loss_share": 1.0, "description": "Full impact" }
      ],
      "loss_accumulation": [
        { "period": "Day 1", "amount_m": 450 },
        { "period": "Week 1", "amount_m": 890 },
        { "period": "Month 1", "amount_m": 1800 },
        { "period": "Quarter 1", "amount_m": 2700 }
      ]
    },
    "financial_contagion": {
      "banking": { "npl_increase_pct": 2.3, "provisions_eur_m": 340, "cet1_impact_bps": -45 },
      "insurance": { "claims_gross_eur_m": 1200, "reinsurance_recovery_eur_m": 850, "net_retained_eur_m": 350, "solvency_impact_pp": -12 },
      "real_estate": { "value_decline_pct": 18, "vacancy_increase_pct": 8, "rental_income_loss_eur_m_per_year": 45 },
      "supply_chain": { "direct_gdp_pct": -0.8, "indirect_gdp_pct": -1.2, "job_losses": 12000, "trade_disruption_eur_m": 890 }
    },
    "predictive_indicators": {
      "status": "AMBER",
      "probability_event": 0.65,
      "key_triggers": ["River level 92% of threshold", "Soil saturation 95%"],
      "thresholds": [
        { "level": "AMBER", "condition": "River level > 4.5m OR rainfall > 100mm/24h" },
        { "level": "RED", "condition": "River level > 5.2m AND rainfall > 150mm/24h" }
      ]
    },
    "network_risk": {
      "critical_nodes": [{ "name": "Power Plant", "centrality": 0.89 }, { "name": "Port", "betweenness": 0.76 }],
      "cascade_path": "Plant → Grid → Water → Hospital",
      "amplification_factor": 2.8,
      "single_points_of_failure": ["Power Grid Substation X", "Main Water Treatment"],
      "contagion_velocity_hours": 4
    },
    "sensitivity": {
      "base_case_loss_m": 2700,
      "parameters": [
        { "name": "Flood depth +20%", "loss_delta_m": 340, "loss_delta_pct": 12.6 },
        { "name": "Duration +48h", "loss_delta_m": 180, "loss_delta_pct": 6.7 }
      ]
    },
    "multi_scenario_table": [
      { "return_period_y": 10, "probability_pct": 10, "expected_loss_m": 890, "buildings": 45, "recovery_months": 3 },
      { "return_period_y": 100, "probability_pct": 1, "expected_loss_m": 2700, "buildings": 194, "recovery_months": 18 }
    ],
    "stakeholder_impacts": {
      "residential": { "households_displaced": 8500, "displacement_days": 45, "uninsured_loss_eur_m": 120 },
      "commercial": { "businesses_interrupted": 340, "downtime_days": 28, "supply_chain_multiplier": 2.4 },
      "government": { "emergency_cost_eur_m": 45, "infrastructure_repair_eur_m": 280, "tax_revenue_loss_eur_m_per_year": 35 },
      "financial": { "loan_defaults_eur_m": 180, "insurance_claims_eur_m": 1200, "cet1_impact_bps": -50 }
    },
    "model_uncertainty": {
      "data_quality": { "exposure_pct": 85, "valuations_pct": 70, "vulnerability_pct": 60, "historical_pct": 75 },
      "limitations": ["Cascading effects may be underestimated", "Business interruption simplified"],
      "uncertainty_pct": { "hazard": 25, "exposure": 15, "vulnerability": 30, "combined": 45 },
      "backtesting": [
        { "event": "Melbourne 2010", "predicted_eur_m": 420, "actual_eur_m": 450, "error_pct": -7 },
        { "event": "Victoria 2011", "predicted_eur_m": 680, "actual_eur_m": 750, "error_pct": -9 }
      ]
    }
  }
}
```

---

## 11. Priority Implementation Order

1. **Backend:** `stress_report_metrics.compute_report_v2(total_loss, zones, city_name, event_type, severity)` returning the above structure (with placeholders).
2. **API:** Include `report_v2` in stress test execute response and in report GET; store in `report_data` when generating report.
3. **Frontend:** Extend report type and `StressTestReportContent` to render each V2 section when present.
4. **Later:** Replace placeholders with Monte Carlo, cascade/graph, historical events, and (where useful) LLM.

This keeps a single place (per stress test, city/region, enterprise) where metrics are generated and a clear path to plug in real engines.
