# Stress Test Report Review — Institutional Level (BlackRock/Palantir)

**Report:** Odesa • Flood Extreme 100Y  
**Date reviewed:** 2026-02-27  
**Purpose:** Verify correctness and institutional-grade quality for risk committee / external disclosure readiness.

---

## Executive assessment

The report is **largely correct and already at institutional level** in structure, methodology disclosure, regulatory alignment, and multi-agent consensus. A few consistency and presentation tweaks improve clarity and avoid misinterpretation.

---

## What is correct and at institutional level

- **Executive summary:** Clear headline metrics (€2,091M loss, 393 buildings, 29,420 population), top zones, immediate priorities. Read-aloud and regenerate (AI) support.
- **Decision object (Risk & Intelligence OS):** Consensus (CRITICAL 88%), verdict (REDUCE), horizon (30 days), human review flag. Four agents (sentinel, analyst, advisor, ethicist) with scores and confidence. Aligns with Palantir-style “single pane” decision support.
- **Methodology transparency:** Universal Stress Testing Methodology v2.0, Monte Carlo 100k, contagion matrix, cascade GNN, GPU/FourCastNet NIM. Data quality and regulatory notices stated.
- **Scenario applicability:** Explicit note that the scenario is used as a *hazard/severity template* for the selected location (Odesa); no geographic conflation.
- **Probabilistic metrics:** Expected loss, VaR 95/99%, CVaR 99%, 90% CI, mean, median, σ, MC runs. Standard institutional risk language.
- **Temporal dynamics:** RTO, RPO, recovery window, BI duration, cumulative loss by period (T+0, T+24h, T+72h, T+1w).
- **Financial contagion:** Banking (NPL, provisions, CET1), Insurance (claims, solvency), Real Estate, Supply Chain, total economic impact and multiplier.
- **Predictive indicators:** AMBER/RED/BLACK thresholds, P(event), river level, soil saturation, model confidence. Actionable early-warning framing.
- **Network/systemic risk:** Critical nodes, centrality, cascade path, amplification, single points of failure.
- **Sensitivity analysis:** Flood depth, duration, timing, warning time with delta impact.
- **Multi-scenario comparison:** Return periods 10Y–500Y with AEP, loss, buildings, recovery, severity.
- **Stakeholder impacts:** Residential, Commercial, Government, Financial with concrete metrics.
- **Climate scenarios:** RCP 4.5 / 8.5, 2050/2080, frequency shift and loss multiplier. NGFS-style.
- **Insurance coverage:** By segment, insured vs uninsured gap, coverage rate. Clear gap warning.
- **Model uncertainty & backtesting:** Uncertainty bands, conservatism adjustment, backtest table (Sandy, Rhine, Queensland) with error %.
- **Regulatory relevance:** TCFD, NGFS, EBA Climate; entity type and jurisdiction; disclosure required flag.
- **Disclaimers:** Forward-looking, internal use only, not for regulatory submission, data as of date. Aligns with Gap X1–X4.
- **NGFS disclosure draft:** Scenario description, key metrics, limitations, next steps. Suitable as internal draft for review before submission.
- **Document traceability:** Report ID (STR-2026-3EDC006B), Decision Object ID (DEC-2026-02-27-…), CONFIDENTIAL / PENDING APPROVAL.

---

## Fixes applied in codebase

1. **90% CI and number formatting**  
   Large numbers (e.g. 90% CI) now use a consistent report locale (`en-GB`: space thousands, up to 2 decimals) so values like `20 145,74` do not appear in a mixed format. See `formatNumberForReport()` in `StressTestReportContent.tsx`.

2. **Cascade section currency**  
   When the cascade visualizer is embedded in the stress report, it now uses the report currency (e.g. EUR for Odesa) instead of hardcoded USD. Loss amounts and legend text show the same currency as the rest of the report. See `currency` prop on `CascadeVisualizer` and `formatCurrency(..., reportCurrency)`.

---

## Recommendations for maximum institutional clarity

1. **Expected loss vs total loss**  
   The report can show two different “expected loss” figures:  
   - **Expected Loss (probabilistic):** e.g. €9.1B from Monte Carlo mean.  
   - **Total loss (impact summary):** e.g. €2.1B from zone-level direct impact.  
   To avoid confusion, add a one-line clarification in the methodology or key metrics:  
   *“Expected Loss (box) = Monte Carlo mean over the simulated loss distribution; Total loss (Impact summary) = direct scenario impact from zone aggregation.”*  
   If both refer to the same scenario, consider aligning the exposure basis so the two numbers are consistent, or label them explicitly (e.g. “Portfolio MC mean” vs “Direct impact”).

2. **Recovery 7–10 mo vs 18 mo (100Y)**  
   “Recovery 7–10 mo” (temporal dynamics) and “18 mo” in the multi-scenario row for 100Y can look inconsistent. Clarify in the UI or methodology: e.g. “Full economic normalization (7–10 mo)” vs “Sector recovery (18 mo for 100Y scenario).”

3. **Backtesting geography**  
   Backtest uses global events (Sandy, Rhine, Queensland). For a location-specific report (Odesa), consider adding a short note: *“Backtest calibrated on global events; regional calibration for Black Sea/Ukraine can be applied when data is available.”*

4. **Ethicist “future lives”**  
   The value “~1e+15” is technically defensible but may distract. Consider rounding for display (e.g. “very large” or “order of magnitude 10^15”) or a short tooltip so readers understand it is a longtermist scaling factor, not a literal headcount.

5. **Comparable historical events**  
   “No comparable historical events found” is acceptable. For institutional use, optionally state the source: e.g. “Searched: EM-DAT, regional archives. No comparable flood events for Odesa in the reference period.”

6. **Cascade “0 nodes affected” with loss**  
   When a run shows “0 node(s) affected” but “total loss €72.0M”, the loss is from the trigger node. A one-line note (e.g. “Loss includes trigger node”) avoids the impression of a bug.

---

## Conclusion

- **Correctness:** Metrics, methodology, and narrative are consistent and technically sound. The applied fixes (number formatting, cascade currency) remove minor inconsistencies.
- **Institutional level:** Structure, regulatory alignment (TCFD/NGFS/EBA), disclaimers, multi-agent consensus, and disclosure draft are at the level expected for BlackRock/Palantir-style risk and intelligence reporting.
- **Next steps:** Optional clarifications above (expected vs total loss, recovery wording, backtest scope, ethicist display, historical-events source, cascade trigger loss) will further reduce the risk of misinterpretation by committees or auditors.

**PDF export (2026-02):** The stress test PDF has been aligned with the on-screen report:
- Monte Carlo runs shown as **100,000** (was 10K) in methodology text and templates.
- **Decision Object** section added when present: Consensus (level, score, confidence, agents), Verdict (action, horizon, human review), Suggested actions, Decision object ID.
- **Scenario applicability** note added when scenario and city are known: clarifies that the scenario is used as a hazard/severity template for the selected location.
- Title set to **Stress Test Report V2.0** when Report V2 data is present.
- Frontend passes `decision_object` and `event_name` in the PDF request so the exported file matches the institutional level of the UI report.

Estimates and projections are indicative and do not constitute a guarantee of future results. For internal risk management. Not intended for regulatory submission without separate review.
