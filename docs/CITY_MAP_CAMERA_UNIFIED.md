# Unified City List & Camera Configuration

## Summary

All report updates, map implementation, and city/camera configuration are now applied project-wide.

## Changes

### 1. Reports (project-wide)
- **Regional Action Plan** — included in report and PDF export
- **Cascade Visualizer** — embedded in report with "Add to Report" for simulations
- **Historical Comparisons** — smart matching by event type and geography, in report and PDF
- **Concluding Summary** — AI-generated (LLM), in report and PDF

### 2. Geodata API — Camera Position
- `/api/v1/geodata/cities` now returns `camera_position` for each city:
  - `height` derived from exposure (2.5K–4.5K m)
  - `heading: 60`, `pitch: -35`
- Used by Digital Twin for proper 3D view framing

### 3. Cities Database (API)
- Added: **Riyadh**, **Beirut**, **Kolkata**, **Buenos Aires**, **Tripoli** (Libya)
- Removed duplicate `tripoli_libya` (replaced by `tripoli`)

### 4. Digital Twin — All Cities
- **Google Photorealistic 3D Tiles** — applied to **ALL cities** (Cesium Ion Asset #2275207, global tileset)
- **globe: false, SkyAtmosphere** — as per Cesium snippet for global 3D Tiles
- **Fallback** — OSM Buildings if Google load fails
- **Picker** — uses full API city list with `camera_position`
- **Asset ID** — resolves any city from API when not in premium `CITY_DATA`
- **Dynamic asset** — uses `camera_position` from API when available

### 5. Command Center
- **CITY_COORDINATES** — added Riyadh, Beirut, Kolkata, Buenos Aires
- **findCityCoordinates** — covers all cities
- **selectedZoneAsset** — includes `exposure` and `impactSeverity` for proper resolution

## Flow

1. **Zone/event/country/city selection** → uses `CITY_COORDINATES` + API cities
2. **Digital Twin** → resolves city from `CITY_DATA`, API cities, or dynamic asset
3. **Camera** → uses `camera_position` from API or `google3dCameraHeight` for Melbourne
4. **Report** → all sections (regional plan, cascade, historical, concluding) in web and PDF
