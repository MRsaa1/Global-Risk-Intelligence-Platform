# External databases to integrate for stress tests and report methodology

This document lists **external data sources** recommended for integration so that the **report methodology** (probabilistic metrics, temporal dynamics, backtesting, financial contagion, sector metrics) and **historical event calibration** use real loss and impact data, not only seed/placeholder data.

**Current state:** The platform uses internal seed (`stress_test_seed.HISTORICAL_EVENTS`), USGS (earthquakes), NOAA Storm Events (US storms), and hardcoded backtesting lists. EM-DAT, sigma, national disaster DBs, and other sources below are **not** integrated.

---

## 1. Climate and natural disasters (flood, storm, drought, fire, heat, wind, heavy_rain)

Used in: stress test types `climate`, `flood`, `wind`, `heat`, `heavy_rain`, `drought`, `fire`; report sections: backtesting, temporal dynamics (RTO/recovery), probabilistic (loss distribution), sector (insurance/real_estate).

| Source | Coverage | Data provided | Use in platform | Priority |
|--------|----------|---------------|------------------|----------|
| **EM-DAT** (CRED) | Global, 1900+ | Disasters: type, date, country, deaths, affected, economic damage (USD), disaster subtype | Historical events import; backtesting actual loss; recovery time; calibration of loss distributions | **High** |
| **NatCatSERVICE** (Munich Re) | Global | Insured/uninsured losses, fatalities, event type, region, year | Sector metrics (insurance); validation of loss estimates; sigma-style summaries | High (licence) |
| **sigma** (Swiss Re) | Global | Annual natural catastrophe reports: top events, economic/insured losses by region and peril | Sector/insurance block; “comparative events” in report; methodology citations | **High** |
| **NOAA Storm Events** | US | Storm events, damage property/crops, deaths/injuries, type, state, date | Already in `historical_events_importer`; extend to full use in backtesting | Done (expand) |
| **FEMA Disaster Declarations** | US | Declarations, counties, disaster type, date | Import for US; temporal (recovery), geographic scope | Medium (API exists, not implemented) |
| **GDV / national insurance associations** | DE, EU, etc. | Loss statistics by peril and region | Regional backtesting; insurance sector metrics for EU | Medium |
| **NCEI / NOAA Billion-Dollar Disasters** | US | Curated list of billion-dollar events, CPI-adjusted loss | Backtesting, probabilistic (tail events) | Medium |
| **National disaster databases** (e.g. DesInventar, national civil protection) | By country | Local events, losses, affected | Region-specific historical events and backtesting | Per region |

---

## 2. Seismic (earthquake, tsunami)

Used in: stress test type `seismic`; report: backtesting, temporal, sector (real_estate, insurance).

| Source | Coverage | Data provided | Use in platform | Priority |
|--------|----------|---------------|-----------------|----------|
| **USGS Earthquake Catalog** | Global | Magnitude, location, time, depth; no loss | Already in importer; severity from magnitude; need loss from elsewhere | Done (expand) |
| **EM-DAT** | Global | Earthquake/tsunami events with economic loss, deaths | Map to USGS by date/region; fill `financial_loss_eur`, `casualties`, `recovery_time_months` | **High** |
| **GEM (Global Earthquake Model)** | Global | Hazard and risk; some impact/loss data | Calibration of severity–loss curves; validation | Medium |
| **National seismic + impact** (e.g. JMA, CGS) | Japan, China, etc. | Events + sometimes loss estimates | Regional backtesting and comparables | Per region |

---

## 3. Financial and regulatory stress

Used in: stress test types `financial`, `regulatory`; report: probabilistic (VaR/CVaR), financial contagion (NPL, CET1, provisions), sector (bank, insurance), backtesting.

| Source | Coverage | Data provided | Use in platform | Priority |
|--------|----------|---------------|-----------------|----------|
| **Laeven & Valencia (IMF) – Banking Crises** | Global, historical | Crisis dates, fiscal cost, output loss, duration | Backtesting “predicted vs actual”; calibration of severity–loss | **High** |
| **BIS – Statistics / stress test results** | Global | Macro/financial stats; some public stress outcomes | Contagion assumptions; regulatory context | Medium |
| **ECB/EBA – EU-wide stress tests** | EU | Published results (CET1, losses by scenario) | Calibration of bank sector impact; methodology reference | Medium |
| **FRB – CCAR / stress test** | US | US bank stress results | US bank sector; comparables | Medium |
| **Historical crisis losses** (academic / central bank papers) | By event | Systemic loss, NPL, GDP impact | Contagion and sector default parameters | Medium |

---

## 4. Cyber

Used in: stress test type (cyber); report: backtesting, temporal (RTO/RPO), sector (enterprise).

| Source | Coverage | Data provided | Use in platform | Priority |
|--------|----------|---------------|-----------------|----------|
| **VERIS / DBIR (Verizon)** | Global, annual | Incidents by type, cost, sector | Backtesting; “comparative cyber events”; loss distribution | **High** |
| **IBM Cost of a Data Breach** | Global | Cost per record, by industry and region | Sector metrics; calibration of loss per severity | High |
| **ENISA Threat Landscape** | EU | Threat types, trends | Scenario and trigger design | Low–Medium |
| **National CERT/CSIRT** (e.g. BSI, CISA) | By country | Incident counts, sometimes impact | Regional backtesting | Per region |

---

## 5. Pandemic

Used in: stress test type `pandemic`; report: temporal, contagion, sector (enterprise, insurance).

| Source | Coverage | Data provided | Use in platform | Priority |
|--------|----------|---------------|-----------------|----------|
| **EM-DAT** | Global | Pandemic events, deaths, economic impact | Historical pandemic events; recovery time; calibration | **High** |
| **WHO / Johns Hopkins** | Global | Cases, deaths, time series | Already used elsewhere; link to stress scenario dates | Medium |
| **Oxford COVID-19 Government Response Tracker** | Global | Policy indices, dates | Temporal (duration of measures); severity proxy | Low–Medium |

---

## 6. Geopolitical, conflict, civil unrest

Used in: stress test types `political`, `military`, `protest`, `uprising`, `civil_unrest`; report: backtesting, sector (enterprise, defence), temporal.

| Source | Coverage | Data provided | Use in platform | Priority |
|--------|----------|---------------|-----------------|----------|
| **UCDP (Uppsala Conflict Data Program)** | Global | Conflict dates, fatalities, type, location | Historical events; severity; duration | **High** |
| **ACLED** | Global | Events, fatalities, actors, location, date | Granular events; comparables; geographic scope | High |
| **EM-DAT** | Global | Disasters linked to conflict (e.g. displacement) | Economic loss, displaced; combine with UCDP/ACLED | Medium |
| **IISS / SIPRI** | Global | Military expenditure, conflict summaries | Context for severity and sector impact | Low |

---

## 7. Insurance and reinsurance (sector metrics and validation)

Used in: report sections “insurance”, “financial contagion”, sector_metrics; calibration of claims vs total loss.

| Source | Coverage | Data provided | Use in platform | Priority |
|--------|----------|---------------|-----------------|----------|
| **sigma (Swiss Re)** | Global | Nat cat and man-made losses; insured vs economic; by region/peril | Insurance block; “top events”; methodology note | **High** |
| **NatCatSERVICE (Munich Re)** | Global | Insured losses, events, topics | Same as above; alternative or complement | High (licence) |
| **IIF / national insurance associations** | By country | Aggregated claims, premiums | Regional sector metrics | Medium |

---

## 8. Cross-cutting: recovery and temporal

Used in: report “temporal dynamics”, RTO/RPO, time to full recovery, business interruption.

| Source | Coverage | Data provided | Use in platform | Priority |
|--------|----------|---------------|-----------------|----------|
| **EM-DAT** | Global | Duration, recovery (when available) | Default recovery_time_months by event type | High |
| **Historical events (own DB)** | After import | `recovery_time_months`, `duration_days` | Median recovery by event_type/region | High (already model) |
| **Sector-specific studies** | By sector | RTO/RPO after disaster type | Override defaults in recovery_calculator | Medium |

---

## 9. Summary: what to implement first

1. **EM-DAT** – one integration for climate, seismic, pandemic, (and conflict where applicable): fill `financial_loss_eur`, `casualties`, `recovery`, and feed backtesting + comparables.
2. **sigma (Swiss Re)** – public reports/datasets: top events, insured vs economic loss; use in report narrative and sector/insurance block.
3. **Laeven & Valencia (or equivalent)** – financial crises: backtesting and calibration for financial/regulatory stress.
4. **VERIS/DBIR (Verizon)** – cyber: backtesting and loss calibration for cyber scenarios.
5. **UCDP or ACLED** – geopolitical/conflict: historical events and severity for political/military/civil_unrest.
6. **FEMA** – complete existing stub in `historical_events_importer` for US disasters.
7. **NatCatSERVICE / GDV / national DBs** – as licences and priorities allow, for insurance and regional accuracy.

---

## 10. Mapping to report V2 sections

| Report section | Main data needs | Suggested sources |
|-----------------|-----------------|--------------------|
| Probabilistic (VaR, CVaR, distribution) | Historical loss distribution by event type/region | EM-DAT, sigma, NatCat, Laeven & Valencia (financial), DBIR (cyber) |
| Temporal (RTO, RPO, recovery) | Duration and recovery by event type | EM-DAT, historical_events, sector studies |
| Financial contagion (NPL, CET1, insurance) | Crisis loss, claims, sector impact | Laeven & Valencia, ECB/EBA, sigma, NatCat |
| Backtesting (predicted vs actual) | Actual loss per event, region, type | EM-DAT, NOAA, FEMA, sigma, USGS+EM-DAT, DBIR, UCDP/ACLED |
| Sector metrics (insurance, real_estate, bank) | Sector loss and ratios | sigma, NatCat, ECB/EBA, national associations |
| Comparative historical events | Comparable events with loss/duration | All of the above via unified historical_events import |

---

*Document version: 1.0. Aligns with `StressTestType`, `stress_report_metrics`, and `HistoricalEvent` model.*

---

## Technical Spec v1 (canonical model, dedup, quality, governance)

Для перехода от «списка источников» к реализации добавлен отдельный документ:

**[EXTERNAL_DATABASES_TECHNICAL_SPEC_V1.md](./EXTERNAL_DATABASES_TECHNICAL_SPEC_V1.md)**

В нём:

- **Каноническая модель:** raw_source_records → normalized_events → event_entities, event_losses, event_impacts, event_recovery.
- **Реестр и приоритеты:** source_registry (license, priority_rank, SLA).
- **Нормализация денег:** amount_original, currency, amount_usd_nominal, amount_usd_real, base_year; fx_rates, cpi_index.
- **Дедупликация:** алгоритм match (время ±7 дней, гео, name similarity), порог merge ≥ 0.75.
- **Quality Score Q** и пороги (прод / narrative / только лог).
- **Missing data policy:** без подстановки 0.5; null + confidence; imputed только с флагом.
- **Версионирование:** processing_runs, dataset_version; backtesting по фиксированной версии.
- **Порядок внедрения** и связь с текущими моделями (HistoricalEvent, BacktestRun, stress_report_metrics).

### Реализовано (по спеце v1)

- **EM-DAT CSV:** загрузка через `POST /api/v1/risk/events/sync?source=emdat` с телом CSV (file upload). Цепочка: extract → normalize → event_entities + event_losses, event_impacts, event_recovery. Адаптер: `apps/api/src/services/emdat_csv_adapter.py`, ETL: `external_risk_etl.run_full_sync_emdat`.
- **USGS:** как и раньше `source=usgs`; в materialize добавлена запись event_losses (оценка по magnitude).
- **Quality scoring:** расчёт Q (0.35·completeness + 0.25·source_trust + 0.20·freshness + 0.20·consistency), запись в data_quality_scores. `GET /api/v1/risk/quality?source=&min_q=&recompute=` — список оценок и опция пересчёта.
- **Backtesting runs:** `GET /api/v1/risk/backtesting?dataset_version=&source_name=` — список processing_runs с dataset_version для воспроизводимости. В модель BacktestRun добавлены поля dataset_version и event_uid (миграция 20260301_0002).
