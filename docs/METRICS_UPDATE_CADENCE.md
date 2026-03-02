# Metrics & Risk Zones — Update Cadence

## Current State (as of Feb 2025)

### Risk Scores (Cities / Hotspots)
| Component | Refresh | Details |
|-----------|---------|---------|
| **City Risk Calculator** | 6h cache | `_cache_ttl_hours = 6` in GeoDataService; zone counts and globe update with situation |
| **External APIs** | On cache refresh | When cache expires or `?recalculate=true`, USGS + Weather used so scores reflect real events |
| **First load** | Fast path | No external APIs (avoids timeout); static zone-based scores |
| **After TTL** | Full refresh | Recalc with USGS/weather so Critical/High/Medium/Low counts and hotspots reflect changing situation |
| **WebSocket stream** | ~5 sec per city | One city per tick; risk updates pushed to globe |

### Portfolio Summary (Capital at Risk, etc.)
| Component | Refresh | Details |
|-----------|---------|---------|
| **geodata/summary** | Once on load | CommandCenter fetches once; no refetch |
| **portfolio_summary cache** | 1 hour | Backend cache TTL |
| **Risk Velocity, WoW** | Static | Derived from `weightedRisk`; not from real time series |

### Risk Zones (Critical / High / Medium / Low)
| Source | Refresh | Details |
|--------|---------|---------|
| **analytics/risk-distribution** | 2 min cache | Counts **assets** by risk level from DB |
| **risk_zones API** | Static | In-memory `ZONE_COORDINATES`; no recalculation |
| **Geo hotspots** | 24h | From CityRiskCalculator cache |

### Historical / Current / Forecast Events
| Type | Source | Refresh |
|------|--------|---------|
| **Historical (1970+)** | DB | On query |
| **Current (0–1yr)** | DB / feeds | On query |
| **Forecast (5–30yr)** | Climate scenarios | Cached (climate 24h) |

---

## Recalculation behaviour

- Risk scores are recalculated when:
  1. First request hits `/geodata/hotspots` or `/geodata/summary` (fast, static factors only)
  2. `?recalculate=true` is passed (full refresh with USGS + weather)
  3. Cache expires (6h) — **next** request triggers full recalc **with external data** (USGS, weather) so zone counts and globe reflect changing situation in countries/cities
  4. WebSocket stream runs (one city at a time, every 5 sec)

---

## Target: Continuous Tracking

### Implemented (Feb 2025)

1. **geodata/summary** — returns `critical_count`, `high_count`, `medium_count`, `low_count` (zone counts from city risk scores)
2. **CommandCenter** — polls geodata/summary every **5 minutes**; metrics and zone counts update automatically
3. **platformStore** — stores `highCount`, `mediumCount`, `lowCount` alongside `criticalCount`

### Still To Do

1. **analytics/risk-distribution** — already cached 2 min; wire to Dashboard KPIs
2. **Risk scores** — daily full recalc (Celery beat) or shorter cache TTL
3. **Hotspots refresh** — optional 10 min reload of globe hotspots for updated city list
