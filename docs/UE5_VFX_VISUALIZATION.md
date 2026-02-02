# Unreal Engine 5 VFX for Disaster Visualization

This document outlines how to use **Unreal Engine 5** for high-fidelity disaster visualization (flood, wind, destruction) on real 3D city models, complementing the web-based Cesium/Deck.gl stack.

---

## Overview

| Use case | Web (Cesium/Deck) | UE5 |
|----------|-------------------|-----|
| Real-time dashboard | Yes | No (desktop app) |
| Flood / wind zones | Polygon layers, sliders | FluidFlux, Chaos Physics |
| Metro flooding | Cylinder markers | Level streaming, FluidFlux |
| Video / presentations | Limited | Best (export video) |
| VR / immersive | Limited | Full support |

**Recommendation:** Use the platform’s web stack for day-to-day monitoring and UE5 for marketing videos, engineering review, and immersive scenarios.

---

## Setup

### 1. Unreal Engine 5

- Install **UE 5.3+** (Epic Games Launcher).
- **Windows:** Minimum 8-core CPU, 32 GB RAM, NVIDIA RTX 3060 (12 GB VRAM). Recommended: 16-core CPU, 64 GB RAM, NVIDIA RTX 4090 (24 GB VRAM).
- **Mac (Apple Silicon):** UE5 runs natively on M1/M2/M3 (Metal). Example: **MacBook Pro M1 Max** (10-core CPU, 32-core GPU, 32 GB RAM) is sufficient for Cesium + FluidFlux at moderate settings; use Metal and Apple Silicon build from Epic. See [Running on Mac (Apple Silicon)](#running-on-mac-apple-silicon) below.

### 2. Cesium for Unreal

- Install **Cesium for Unreal** from the [Epic Marketplace](https://www.unrealengine.com/marketplace/en-US/product/cesium-for-unreal) (free).
- Add **Google Photorealistic 3D Tiles**: add your Google Maps API key in Project Settings → Cesium → Tilesets, then drag “Cesium World Terrain” + “Cesium Google Photorealistic 3D Tiles” into the level.
- Result: real city geometry (2,500+ cities) in UE5.

### 3. FluidFlux (flood simulation)

- **FluidFlux** (Imaginary Blend): UE5 plugin for shallow-water flood simulation with waves, flow, caustics, and object interaction. Check current pricing on [Fab](https://www.fab.com) (historically ~$99–149; public price is not always listed).
- Current version: **FluidFlux 3.0.4** (supports UE 5.3–5.5). Key features: glass system, underwater lighting, rain particles, buoyancy editor.
- In-editor: add a Fluid Flux Actor, set simulation grid (e.g. 2048×2048), cell size (~1 m), initial water height (m), and bind to terrain/Cesium tiles.

### 3b. LiquiGen (JangaFX) — alternative for film-quality liquid

- **LiquiGen** (JangaFX, **$299.99** indie perpetual or **$19.99/month** subscription) is a **standalone liquid simulation app** (like EmberGen), **not** a UE5 plugin.
- Workflow: simulate in LiquiGen (separate app) → export as Alembic, Flipbook, or VAT (Vertex Animation Textures) → import into UE5 for rendering.
- Best for: film-quality liquid VFX for cinematics (higher quality than FluidFlux), but **not** real-time editable inside UE5—use pre-baked simulations.

| Feature | FluidFlux | LiquiGen |
|--------|-----------|----------|
| Type | UE5 plugin | Standalone app |
| Integration | Direct (Blueprint/C++) | Export → Import |
| Real-time in UE5 | Yes | No (pre-baked) |
| Quality | Good (game-ready) | Excellent (film-quality) |
| Price | Check Fab (~$99–149 historically) | $299.99 (indie perpetual) |
| Use case | Interactive flooding in UE5 | High-quality cinematics |
| Learning curve | Medium | Medium–High |

### 4. Chaos Physics (wind / destruction)

- **Chaos** is built into UE5: Geometry Collection for destructible meshes, Wind Directional Source for wind force.
- Convert Cesium/Google 3D Tiles geometry to Static Meshes or Geometry Collections, enable Chaos, add Wind Directional Source (speed in km/h, direction, turbulence) for Cat 1–5 scenarios.

---

## Data pipeline: Platform API → UE5

The platform exposes disaster data via REST; UE5 can consume it for scenario setup and sync.

### Open-Meteo (live forecast)

| API | Purpose in UE5 |
|-----|----------------|
| `GET /api/v1/climate/flood-forecast?latitude=&longitude=&days=7` | Center, max flood depth (m), risk level → set FluidFlux water height and extent. |
| `GET /api/v1/climate/wind-forecast?latitude=&longitude=&days=7` | Max wind (km/h), category → set Wind Directional Source speed/direction. |
| `GET /api/v1/climate/metro-flood?latitude=&longitude=&radius_km=15` | Metro entrances + flood depth → place water volumes or triggers at entrances. |

### High-fidelity (WRF/ADCIRC pre-computed scenarios)

When using **pre-computed** WRF or ADCIRC outputs (after ETL), use the high-fidelity endpoints with a `scenario_id`:

| API | Purpose in UE5 |
|-----|----------------|
| `GET /api/v1/climate/high-fidelity/scenarios` | List available scenario IDs (e.g. `wrf_nyc_202501`, `adcirc_galveston_202501`). |
| `GET /api/v1/climate/high-fidelity/flood?scenario_id=<id>` | Pre-computed flood: polygon, `max_depth_m`, `risk_level`, `valid_time` → FluidFlux height/extent. |
| `GET /api/v1/climate/high-fidelity/wind?scenario_id=<id>` | Pre-computed wind: `wind_speed_kmh`, `category`, polygon → Wind Directional Source. |
| `GET /api/v1/climate/high-fidelity/metadata?scenario_id=<id>` | Scenario metadata: `model` (wrf \| adcirc), `run_time`, `bbox`, `resolution`. |
| `GET /api/v1/climate/high-fidelity/export?scenario_id=<id>&format=csv` | Optional: table data (cells/polygons) for reports or external tools. |

**Sync from high-fidelity API (Blueprint or C++):**

1. User selects `scenario_id` (e.g. from a dropdown or config).
2. Call `GET .../high-fidelity/flood?scenario_id=<id>` and `GET .../high-fidelity/wind?scenario_id=<id>` (and metadata if needed).
3. Parse JSON (same shape as flood-forecast/wind-forecast): apply `max_flood_depth_m` / polygon to FluidFlux, `wind_speed_kmh` / direction to Wind Source.
4. Use the same level and logic as for real-time; only the data source (URL + scenario_id) changes.

**Workflow (high level):**

1. Run a scenario in the web Command Center (flood/wind/metro toggles, water level slider), or choose a high-fidelity scenario by `scenario_id`.
2. Call the APIs above from a UE5 Blueprint or C++ module (or a small Python/Node script that writes JSON).
3. In UE5: set FluidFlux water level from `max_flood_depth_m`, Wind Source from `max_wind_kmh` / category, and optional metro cylinders/volumes from `metro-flood` entrances.
4. Record in-editor or package a build for presentations/VR.

---

## Detailed analysis for engineers

- **In UE5:** Add a layer with labels or data overlays on top of the scene: depth, velocity, return period per polygon (from high-fidelity flood/wind responses). Use Blueprint or a C++ module that reads the same high-fidelity endpoints and draws text/decals or updates a HUD.
- **Export from selected area:** Export a report (CSV/JSON) for the current view or selected region—e.g. list of polygons with depth, risk level, and coordinates. The platform can expose `GET /api/v1/climate/high-fidelity/export?scenario_id=...&format=csv` (and optionally bbox) so UE5 or a companion script can request table data for cells/polygons and save it to disk.
- **Return period and metadata:** Use `metadata?scenario_id=...` for `run_time`, `resolution`, and `model`; display in UE5 UI or in the exported report for traceability.

---

## Video generation for media

- **In UE5:** Use **Sequencer** + a camera: design a shot (path, duration), then render to video via **Movie Render Queue** (MRQ). Scenario and parameters (water height, wind speed) come from the same API (high-fidelity or flood-forecast/wind-forecast); no change to sync logic, only to how the frame is produced (MRQ instead of real-time).
- **Step-by-step:**
  1. Load the desired scenario by `scenario_id` (or latitude/longitude for live forecast).
  2. Call `GET .../high-fidelity/flood?scenario_id=...` and `.../wind?scenario_id=...` (or the forecast endpoints).
  3. Set FluidFlux and Wind Source from the JSON (same as for real-time sync).
  4. Open Sequencer, add a camera, keyframe path and timing.
  5. Open Movie Render Queue, add the sequence, choose output format (e.g. MP4), and render.
- Result: video files that match the platform’s scenario data for use in presentations or media.

---

## VR for immersive planning

- **Setup:** Enable VR in the UE5 project (e.g. **SteamVR** or **OpenXR** in Project Settings → Plugins). Use the same level and the same API-driven data (high-fidelity or forecast); no separate content build is required.
- **Workflow:** User puts on the headset, selects a scenario (e.g. high-fidelity by `scenario_id`), and the same Blueprint/C++ sync fetches flood and wind from the API and updates FluidFlux and Wind Source. Navigation and inspection are in VR.
- **Performance:** For stable frame rate in VR, consider: **LOD** and reduced draw distance for Cesium/Google 3D Tiles; **smaller simulation area** or lower grid resolution for FluidFlux; **simplified FluidFlux** (e.g. fewer particles or lower quality) in VR if needed; and disabling or simplifying heavy post-process in VR.

---

## Suggested UE5 workflow

1. **Week 1–2:** Learn Cesium for Unreal; load Google 3D Tiles for a target city; confirm performance (LOD, streaming).
2. **Week 3–4:** Add FluidFlux; tune grid size and water height for a small area; test rain/inflow if needed.
3. **Week 5–6:** Add Wind Directional Source and optional Chaos destruction (simplified geometry first); map Cat 1–5 to wind speed.
4. **Week 7–8:** Implement “sync from API”: Blueprint or C++ that calls the platform’s climate endpoints (flood-forecast, wind-forecast, or high-fidelity/flood and high-fidelity/wind with `scenario_id`) and sets FluidFlux/Wind parameters (and optionally metro markers).
5. **Week 9–10:** Metro/subway: use Level Streaming for underground; add water volumes or FluidFlux sources at entrance coordinates from `metro-flood`.
6. **Week 11–12:** Lighting, post-process, sound; export video via Sequencer + Movie Render Queue for presentations; optionally enable VR (SteamVR/OpenXR) and tune LOD/FluidFlux for immersive planning.

---

## Risk zones (color coding)

- In the **web** stack, flood and wind layers already use risk-based colors (flood: normal→elevated→high→critical; wind: Cat 1–5).
- In **UE5**, you can drive material or post-process from the same logic: e.g. Material Parameter Collection with “RiskLevel” 0–1, or per-building material override from a data asset populated from the platform’s stress test / climate APIs.

---

## Running on Mac (Apple Silicon)

To run the full pipeline on a Mac (e.g. MacBook Pro M1 Max):

1. **Platform API + Web (local)**  
   From the repo root, start infrastructure and the API so UE5 can pull climate data from your machine:
   - `docker compose up -d postgres redis neo4j minio` (or use [QUICK_START.md](QUICK_START.md)).
   - API: `cd apps/api && uvicorn src.main:app --reload --host 0.0.0.0 --port 9002`
   - Web (optional): `cd apps/web && npm run dev`
   - **API base URL for UE5:** `http://localhost:9002/api/v1` (use this in Blueprint/C++ or a small HTTP client script).

2. **UE5 on Mac**  
   - Install **Unreal Engine 5.3+** for **Apple Silicon** from the Epic Games Launcher (Metal build).
   - Install **Cesium for Unreal** from the Marketplace (Mac is supported).
   - **FluidFlux:** Check [Fab](https://www.fab.com) for Mac/Apple Silicon support of the current FluidFlux build.
   - In your UE5 project, point all climate API calls to `http://localhost:9002/api/v1` (e.g. `.../climate/flood-forecast`, `.../climate/high-fidelity/flood?scenario_id=...`). Use `127.0.0.1` if `localhost` is not resolved.

3. **Quick check**  
   With the API running, open in browser: [http://localhost:9002/docs](http://localhost:9002/docs). Try `GET /api/v1/climate/flood-forecast?latitude=40.71&longitude=-74.01&days=7` — you should get JSON. The same URL from UE5 (or any HTTP client) will work when the API is on the same Mac.

**Getting scenario data into UE5 (two options):**

- **Option A — Call API directly from UE5:** In Blueprint or C++, send HTTP GET to `http://localhost:9002/api/v1/climate/high-fidelity/flood?scenario_id=<id>` and `.../wind?scenario_id=<id>` (and `.../metadata?scenario_id=<id>` if needed). Parse the JSON and set FluidFlux / Wind Source from the response. Works when the API is running on the same machine or reachable network.
- **Option B — Fetch JSON to disk, then read in UE5:** From the repo root (with API running), run: `python scripts/ue5_fetch_scenario.py --scenario-id wrf_nyc_001`. This writes `flood.json`, `wind.json`, and `metadata.json` into `./ue5_scenario/` (or `--output-dir`). In UE5, read those files (e.g. Blueprint “Read File” + “Parse JSON”, or C++ file read + JSON parse) and apply the same values to FluidFlux and Wind Source. Useful when UE5 and the API are not on the same machine, or for offline iteration.

See [RUN_ON_MAC.md](RUN_ON_MAC.md) for a concise step-by-step checklist.

---

## Related docs

- [RUN_ON_MAC.md](RUN_ON_MAC.md) — Step-by-step: run platform + UE5 on your Mac.
- [NO_GPU_SIMULATIONS.md](NO_GPU_SIMULATIONS.md) — Web-based flood/wind (Open-Meteo, no GPU).
- [GOOGLE_PHOTOREALISTIC_3D_TILES.md](GOOGLE_PHOTOREALISTIC_3D_TILES.md) — 3D Tiles and Cesium.
- [VISUALIZATION_STACK.md](VISUALIZATION_STACK.md) — Overall visualization architecture.
