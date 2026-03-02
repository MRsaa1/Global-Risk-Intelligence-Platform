# Risk Calculation System

## Overview

The platform uses a dynamic risk calculation system for 71 cities worldwide. Risk scores are calculated using a weighted formula combining multiple risk factors from various data sources.

## Risk Score Formula

```
risk_score = (
    seismic_risk × 0.20 +
    flood_risk × 0.18 +
    hurricane_risk × 0.15 +
    political_risk × 0.12 +
    economic_exposure × 0.15 +
    infrastructure_risk × 0.10 +
    historical_volatility × 0.10
)
```

**Total weights = 1.0**

## Risk Factors

| Factor | Weight | Data Source | Description |
|--------|--------|-------------|-------------|
| Seismic | 20% | USGS Earthquake Catalog + Seismic Zone DB | Earthquake frequency and magnitude |
| Flood | 18% | Climate Zone + OpenWeather API | Flood probability based on climate |
| Hurricane | 15% | Climate Zone + Historical Data | Typhoon/cyclone exposure |
| Political | 12% | Political Region Classification | Government stability indicators |
| Economic | 15% | Portfolio Data | Asset exposure and concentration |
| Infrastructure | 10% | Regional Assessment | Infrastructure quality proxy |
| Historical | 10% | Major Events Database | Past disaster frequency |

## Risk Zones (Gradation)

Cities are categorized into 4 risk levels based on their calculated risk score:

| Level | Condition | Color | Description |
|-------|-----------|-------|-------------|
| **Critical** | risk > 0.8 | Red | Immediate attention required |
| **High** | 0.6 < risk ≤ 0.8 | Orange | Elevated risk, monitoring needed |
| **Medium** | 0.4 < risk ≤ 0.6 | Yellow | Moderate risk level |
| **Low** | risk ≤ 0.4 | Green | Acceptable risk level |

## Data Sources

### External APIs (when available)
- **USGS Earthquake Catalog** - Real-time seismic data (free, no API key)
- **OpenWeather API** - Weather and flood risk (requires API key)
- **World Bank WGI** - Political stability indicators (planned)

### Internal Databases
- **Cities Database** - 71 cities with known risk factors
- **Seismic Zone Classification** - Pacific Ring of Fire, Alpine-Himalayan Belt, etc.
- **Climate Zone Classification** - Tropical Cyclone, Monsoon, Coastal Flood, etc.
- **Political Region Classification** - OECD Stable, Emerging, Conflict Zone

## Fallback Strategy

When external APIs are unavailable:

1. **USGS unavailable** → Use known seismic zones (Pacific Ring = 0.85, Alpine-Himalayan = 0.70)
2. **OpenWeather unavailable** → Use climate zone estimates (Tropical = 0.80, Temperate = 0.35)
3. **World Bank unavailable** → Use regional averages (OECD = 0.10, Conflict = 0.90)

## Caching

- Risk scores are cached for 24 hours
- USGS data cached for 6 hours
- Weather data cached for 3 hours
- Force recalculation available via `?recalculate=true` parameter

## API Endpoints

### Get All Hotspots with Risk
```
GET /api/v1/geodata/hotspots
GET /api/v1/geodata/hotspots?recalculate=true
GET /api/v1/geodata/hotspots?min_risk=0.6
```

### Get Single City Risk
```
GET /api/v1/geodata/city/{city_id}/risk
GET /api/v1/geodata/city/tokyo/risk?recalculate=true
```

### Response Example
```json
{
  "type": "Feature",
  "id": "tokyo",
  "geometry": {
    "type": "Point",
    "coordinates": [139.6503, 35.6762]
  },
  "properties": {
    "name": "Tokyo",
    "risk_score": 0.65,
    "confidence": 0.82,
    "risk_factors": {
      "seismic": {
        "value": 0.95,
        "source": "Known Risk Database",
        "details": "Pacific Ring of Fire"
      },
      "flood": {
        "value": 0.60,
        "source": "Climate Zone",
        "details": "Tropical cyclone zone"
      }
    }
  }
}
```

## Monte Carlo Simulation

For stress testing, the platform uses Monte Carlo simulation:

- **Portfolio Loss Simulation** - 10,000 paths with Gaussian copula
- **Cascade Simulation** - 1,000 runs for failure propagation
- **Output Metrics**: VaR 99%, Expected Shortfall (CVaR), Maximum Loss

## Zone Visualization by Event Type

The Digital Twin map uses different visualization styles based on event category:

| Event Type | Visualization | Highlights | Description |
|------------|---------------|------------|-------------|
| **Pandemic/Medical** | Contour (outline) | Hospitals, airports, stadiums | Population density overlay, spread zones |
| **War/Military** | Infrastructure | Power grids, telecom, government | Critical infrastructure targets |
| **Financial** | Financial centers | Stock exchanges, central banks, systemic banks | Strategic financial decision centers |
| **Seismic/Flood/Hurricane** | Contour (outline) | Dams, levees, power grids | Affected area estimation with damage zones |
| **Cyber** | Infrastructure | Data centers, telecom, power | Digital infrastructure targets |
| **Political** | Cylinder | Government buildings, embassies | Political instability zones |

### Visualization Properties

```json
{
  "visualization": {
    "type": "contour | cylinder | infrastructure | financial",
    "color": "#e74c3c",
    "opacity": 0.35,
    "outline": true,
    "outline_color": "#c0392b",
    "outline_width": 3.0,
    "height": 50000,
    "radius": 400000,
    "pulse": true
  },
  "infrastructure_targets": [...],
  "financial_centers": [...]
}
```

## Conflict Zone Override

For cities in active conflict zones (political risk >= 0.85), the algorithm applies a **conflict boost**:

```python
# If political risk >= 0.85 (conflict zone)
final_score = max(final_score, 0.70) + political_risk * 0.30
# Result: minimum 0.70 + 0.25-0.30 boost = 0.95-1.00 (CRITICAL)
```

This ensures that war zones like Kyiv, Gaza, Damascus are correctly classified as CRITICAL.

## Files

| File | Description |
|------|-------------|
| `apps/api/src/data/cities.py` | 85+ cities with coordinates and known risk factors |
| `apps/api/src/services/city_risk_calculator.py` | Risk calculation engine with conflict boost |
| `apps/api/src/services/integral_risk.py` | **Integral risk model**: RiskIndex% = 100×ΣScore_i/ΣMaxScore_i, zones 0–25/25–50/50–75/75–100% |
| `apps/api/src/services/zone_visualization.py` | Zone visualization strategy by event type |
| `apps/api/src/services/external/usgs_client.py` | USGS earthquake API client |
| `apps/api/src/services/external/weather_client.py` | OpenWeather API client |
| `apps/api/src/services/geo_data.py` | GeoJSON preparation service |
| `apps/api/src/services/cache.py` | Caching layer |

## Integral risk model (alternative)

A separate **integral risk** model is available for composite risk as a weighted sum over all risk types:

- **Per risk:** `Score_i = Sev × Prob × Impact × W_country × W_city × W_influence × (1 − Control)`
- **Index:** `RiskIndex% = 100 × Σ Score_i / Σ MaxScore_i`
- **Zones:** 0–25% Low, 25–50% Medium, 50–75% High, 75–100% Critical

Scales (Sev 1–4, Prob 1–5, Impact 1–5) and weight tables are in `integral_risk.py`. Full description and comparison with the current city risk formula: **`docs/RISK_CALCULATION_CURRENT_VS_INTEGRAL.md`**.
