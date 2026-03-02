# Checklist: Feature Ideas Plan (PFRP/ARIN/SAA)

## 1. Today Card (RiskMirror / War Room / Future Focus)

| Item | Status | Where |
|------|--------|-------|
| API `GET /api/v1/dashboard/today-card` | ✅ | `apps/api/src/api/v1/endpoints/dashboard.py` |
| Response: focus, top_risk, dont_touch, main_reason | ✅ | |
| Widget on Dashboard | ✅ | `Dashboard.tsx` — `TodayCardWidget` above Quick Actions |
| Router prefix `/dashboard` | ✅ | `apps/api/src/api/v1/router.py` |

## 2. Panic/Hype Meter

| Item | Status | Where |
|------|--------|-------|
| API `GET /api/v1/dashboard/sentiment-meter` | ✅ | `dashboard.py` |
| Response: value 0–100, label (panic/neutral/hype), main_reason | ✅ | |
| Widget on Dashboard | ✅ | `Dashboard.tsx` — `SentimentMeterWidget` (gauge + reason) |

## 3. Headline to PnL

| Item | Status | Where |
|------|--------|-------|
| API `POST /api/v1/analytics/headline-impact` | ✅ | `apps/api/src/api/v1/endpoints/analytics.py` |
| Body: `{ "headline": "..." }` | ✅ | |
| Response: sectors, direction, volatility_estimate, summary (LLM) | ✅ | |
| Form on Analytics | ✅ | `Analytics.tsx` — block "Headline to PnL" (input + Analyze + result) |

## 4. Climate Haven Finder

| Item | Status | Where |
|------|--------|-------|
| API `GET /api/v1/climate/haven?lat=&lon=` | ✅ | `apps/api/src/api/v1/endpoints/climate.py` |
| Cities logic: composite_risk_score, get_haven_for_location | ✅ | `apps/api/src/data/cities.py` |
| Card "Your climate haven by 2040" | ✅ | `Dashboard.tsx` — `ClimateHavenCard` (default Hamburg 53.55, 9.99) |
| Component | ✅ | `apps/web/src/components/dashboard/ClimateHavenCard.tsx` |

## 5. Signal Score in Threat Feed

| Item | Status | Where |
|------|--------|-------|
| Type `signal_score?: number` on ThreatSignal | ✅ | `apps/web/src/types/events.ts` |
| "Signal first" sort/filter | ✅ | `ThreatIntelFeed.tsx` — checkbox "Signal first" (sort by signal_score desc) |
| Display signal_score when present | ✅ | `ThreatIntelFeed.tsx` — badge "Signal: X%" |

---

## Frontend summary

- **Dashboard**: TodayCardWidget, SentimentMeterWidget, ClimateHavenCard (row above Quick Actions).
- **Analytics**: Headline to PnL block (input + button + sectors/direction/vol/summary).
- **Threat Intel Feed**: "Signal first" checkbox + optional signal_score badge.

Command Center: plan said "виджет на Dashboard **и/или** в Command Center" — реализовано на Dashboard; при желании тот же `TodayCardWidget` можно добавить в Command Center.

---

## How to test

1. **API (в папке `apps/api`):**
   ```bash
   # Установить pytest при необходимости: pip install pytest httpx
   pytest tests/test_dashboard_and_plan_features.py -v
   ```

2. **Вручную:**
   - Запустить API и Web (см. QUICK_START.md).
   - **Dashboard**: открыть `/` — видна строка Today + Sentiment + Climate Haven и Quick Actions.
   - **Analytics**: открыть `/analytics` — вверху блок "Headline to PnL", ввести заголовок, нажать Analyze.
   - **Threat feed**: на Dashboard в блоке "Real-Time Threat Feed" включить "Signal first" и при наличии `signal_score` у сигналов — сортировка и бейдж.

3. **Climate Haven:**  
   `GET /api/v1/climate/haven?lat=53.55&lon=9.99` — должен вернуть город с наименьшим composite risk (например, в той же стране).
