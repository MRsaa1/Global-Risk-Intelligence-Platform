# Full Real-Time Multi-Risk Intelligence Platform — Status vs Plan

Соответствие текущей реализации плану из Gap Analysis.

---

## Phase 1: Real-Time Infrastructure ✅

| Item | Status | Notes |
|------|--------|-------|
| APScheduler (AsyncIOScheduler) | ✅ | `apps/api/src/core/scheduler.py`, lifespan in `main.py` |
| Config: enable_scheduler, scheduler_timezone | ✅ | `config.py` |
| Redis Pub/Sub (event bus) | ✅ | Optional; `event_emitter.py` publishes when enable_redis=True |
| Event types: DATA_REFRESH_COMPLETED, THREAT_DETECTED, MARKET_UPDATE | ✅ | `models/events.py`, frontend `events.ts` |
| Ingestion pipeline | ✅ | `pipeline.py`: snapshot, delta, emit, broadcast threat signals |

---

## Phase 2: Background Data Collectors ✅ (jobs exist; not all push to UI)

| Source | Job file | Schedule | Channel / Push | Visible on frontend? |
|--------|----------|----------|----------------|----------------------|
| GDELT | threat_intelligence_job.py | 15 min | threat_intelligence (broadcast per article) | ✅ Threat Feed (GDELT articles) |
| USGS + NASA FIRMS + NWS | natural_hazards_job.py | 5 min | (no per-event push to channel) | ❌ No dedicated panel |
| WHO | biosecurity_job.py | 60 min | (pipeline emits DATA_REFRESH only) | ❌ No panel |
| CISA KEV | cyber_threats_job.py | 6 h | (same) | ❌ No panel |
| World Bank + IMF + OFAC | economic_job.py | 24 h | (same) | ❌ No panel |
| Open-Meteo | weather_job.py | 30 min | (same) | ❌ No panel |

**Gap:** Only `threat_intelligence` channel gets per-item push (for Threat Feed). Other jobs run but do not broadcast to dedicated channels/panels. Natural hazards / weather / bio / cyber / economic have no live panels.

---

## Phase 3: Social Media / OSINT ⚠️ Partial

| Item | Status | Notes |
|------|--------|-------|
| twitter_client.py | ✅ | Exists |
| reddit_client.py | ✅ | Exists |
| telegram_client.py | ✅ | Exists |
| sentiment_analyzer (NLP) | ✅ | Exists |
| social_media_job.py | ✅ | Exists, aggregates Twitter + Reddit + Telegram, emits to threat_intelligence |
| **social_media_job registered in scheduler** | ✅ | **Added** in `register_jobs.py` (every 10 min, id=`social_media`) |
| enable_social_media, API keys in config | ✅ | config.py |
| ThreatIntelFeed.tsx | ✅ | Dashboard, filter by risk type/source |

**Why only market visible:** GDELT runs and fills Threat Feed when it returns data. Social job is now registered; with enable_social_media=True and API keys, Twitter/Reddit/Telegram will run every 10 min.

---

## Phase 4: Financial Market Data ✅

| Item | Status | Notes |
|------|--------|-------|
| market_data_client.py (Yahoo) | ✅ | VIX, SPX, HYG, LQD, 10Y, EURUSD |
| market_data_job.py | ✅ | Every 5 min, broadcast to market_data |
| market_data_snapshots table | ⚠️ | No DB table in codebase yet; job only broadcasts. To persist history: add model + migration, then insert in job after fetch. |
| SRO module live VIX | ⚠️ | Can use get_latest_market_data_for_sro if snapshots populated |
| MarketTicker.tsx | ✅ | Dashboard |

---

## Phase 5: Cat Model 🔴 Not in scope of current real-time work

Cat model (event set, hazard, vulnerability, loss, AEP/OEP) is separate roadmap. Not required for “real-time data visible on frontend.”

---

## Phase 6: Population & CAD 🔴 Not implemented

population_client, CAD/infrastructure feed — not in current ingestion/jobs.

---

## Phase 7: Frontend Real-Time Experience ⚠️ Partial

| Item | Status | Notes |
|------|--------|-------|
| WebSocket channels: threat_intelligence, market_data | ✅ | usePlatformWebSocket subscribes |
| Live Data Indicator Bar | ⚠️ | Uses lastRefreshBySource (in store) and marketData['VIX']. Timestamps from DATA_REFRESH_COMPLETED; market_data_job now emits it so VIX row shows Xm ago. |
| Threat Feed panel | ✅ | ThreatIntelFeed.tsx, live signals |
| Market ticker | ✅ | MarketTicker.tsx |
| Auto-refresh risk on DATA_REFRESH_COMPLETED | ⚠️ | dataRefreshVersion increments; risk recalculation via geodata/recalculate_cities when pipeline runs with affected_city_ids. |

**Current state:** lastRefreshBySource is in store and updated in WebSocket when event.data.source_id and event.data.summary?.updated_at are present. Jobs using run_ingestion_job emit DATA_REFRESH_COMPLETED; market_data_job was updated to emit it too so Live Data Bar shows market_data timestamp.
---

## Why you only saw “real” financial data

1. **Market** — Only source that both runs on a schedule and pushes a **flat, UI-ready payload** to a channel the frontend consumes. So the ticker updates visibly.
2. **Threat Feed** — GDELT job runs and pipeline broadcasts articles; if GDELT returns empty, the feed stays at 0. Social job is now registered (every 10 min).
3. **Live Data Bar** — Uses lastRefreshBySource and marketData['VIX']; market_data_job now emits DATA_REFRESH_COMPLETED so market_data shows "Xm ago".

---

## Priority next steps (to make more “visible”)

1. ~~**Register social_media_job**~~ — Done (in register_jobs.py).
2. ~~**lastRefreshBySource in store**~~ — Present; updated from WebSocket on DATA_REFRESH_COMPLETED. **market_data_job** now emits DATA_REFRESH_COMPLETED so Live Data Bar gets "market_data" timestamp.
3. Live Data Bar uses `marketData['VIX']` and `lastRefreshBySource` for gdelt, natural_hazards, market_data.
4. (Optional) Add **market_data_snapshots** table + write in market_data_job for history/SRO.
5. (Later) Add natural_hazards / weather / bio / cyber panels that subscribe to dedicated channels.
