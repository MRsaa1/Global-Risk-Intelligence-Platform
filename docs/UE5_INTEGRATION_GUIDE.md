# UE5 Integration Guide: Disaster Visualization

This guide details how to connect your Unreal Engine 5 project to the Risk Platform API to drive FluidFlux (flood) and Chaos (wind) simulations.

## Verification status

| Item | Status |
|------|--------|
| Backend API (climate + high-fidelity + ue5) | ✅ Implemented and available |
| Script `scripts/ue5_fetch_scenario.py` | ✅ Implemented; run with `--scenario-id`, `--api-url`, `--output-dir` |
| Integration in UE5 (Blueprint/VaRest, FluidFlux/Wind) | ⚠️ Not verified (no run in editor) |
| End-to-end guide (this doc + UE5_VFX_VISUALIZATION.md) | ✅ Written; UE5-side steps not verified |

To verify end-to-end: start API, run the fetch script, open UE5 project, and follow Method 1 or 2 below; confirm data flows into FluidFlux/Wind.

---

## Verification checklist (manual)

Perform these steps to verify integration in the UE5 editor. When completed, update the status table at the top of this guide.

1. **Start the API**  
   From repo root: run the platform API (e.g. `uvicorn` on port 9002). Ensure `GET /api/v1/health` returns 200.

2. **Run the fetch script**  
   ```bash
   python scripts/ue5_fetch_scenario.py --scenario-id wrf_nyc_202501 --api-url http://localhost:9002
   ```  
   Confirm `flood.json`, `wind.json`, and `metadata.json` (if applicable) are written to the output directory.

3. **Open the UE5 project**  
   Open your Unreal project that uses Cesium, FluidFlux (or equivalent), and Wind.

4. **Load JSON in Blueprint**  
   In your climate/controller Blueprint: load the fetched JSON (e.g. via File Load String or VaRest / HTTP GET to a local path). Parse the response and read `max_flood_depth_m`, `wind_speed_kmh`, `direction_degrees`.

5. **Bind to FluidFlux and Wind**  
   Map parsed values to the FluidFlux water height (or equivalent) and to the Wind Directional Source speed and rotation (Z).

6. **Verify display**  
   Run PIE or package; confirm flood level and wind direction/speed update according to the scenario data. Check for Z-height alignment with Cesium terrain if applicable.

After completing the checklist, set the row “Integration in UE5 (Blueprint/VaRest, FluidFlux/Wind)” in the status table to ✅ Verified.

---

## Prerequisites

- **Unreal Engine 5.3+**
- **Cesium for Unreal** plugin (free on Marketplace)
- **FluidFlux** plugin (for flood simulation)
- **Python** (for the fetch script, optional if using HTTP in UE5)

## Integration Approaches

You can choose between two methods to get data into UE5:

1.  **Online (Direct API)**: UE5 calls the REST API directly. Good for real-time dashboards.
2.  **Offline (File-based)**: Use the Python script to download JSON, then read in UE5. Good for high-fidelity rendering/offline presentations.

---

### Method 1: Online (Direct API)

#### 1. Blueprint Setup
You need a Blueprint Actor (e.g., `BP_ClimateController`) to handle HTTP requests.
*Note: You may need the "VaRest" plugin or basic C++ implementation for HTTP if built-in tools are insufficient, though UE5 has native HTTP module.*

1.  **Event BeginPlay**:
    - Construct the URL: `http://localhost:9002/api/v1/climate/high-fidelity/flood?scenario_id=wrf_nyc_202501`
    - Call **HTTP GET**.
2.  **On Request Complete**:
    - Parse the JSON response.
    - Extract `max_flood_depth_m`.
3.  **Update FluidFlux**:
    - Get reference to your `FluidFluxSimulation` actor.
    - Set the **Water Level** or **Source Height** property to `max_flood_depth_m`.

#### 2. Wind Setup
Similar to above, call `.../wind?scenario_id=...`.
- Extract `wind_speed_kmh` and `direction_degrees`.
- Get reference to **Wind Directional Source**.
- Map `wind_speed_kmh` to **Speed** (scaling factor may be needed, approx 0.27 m/s per km/h).
- Set Actor Rotation Z to `direction_degrees`.

---

### Method 2: Offline (JSON Files)

#### 1. Fetch Data
Run the provided script from the platform root:
```bash
python scripts/ue5_fetch_scenario.py --scenario-id wrf_nyc_202501
```
This creates `flood.json` and `wind.json` in `./ue5_scenario/`.

#### 2. Import to UE5
In your `BP_ClimateController`:
- Use **File Load String** (Standard Library or plugin) to read `C:/path/to/ue5_scenario/flood.json`.
- Parse JSON string (e.g., using "Json Blueprint Utilities" plugin).
- Apply values to FluidFlux/Wind as in Method 1.

---

## Data Mapping Guide

| API Field | UE5 Component | Property | Notes |
| :--- | :--- | :--- | :--- |
| `max_flood_depth_m` | FluidFlux Actor | `Simulation / Water Height` | May need offset based on terrain absolute Z |
| `wind_speed_kmh` | Wind Directional Source | `Speed` | $1 \text{ km/h} \approx 0.277 \text{ m/s}$ |
| `direction_degrees` | Wind Directional Source | `Rotation (Z)` | 0° = North, 90° = East |
| `valid_time` | SunSky / Directional Light | `Solar Time` | Optional: sync lighting to scenario time |

## Troubleshooting

- **CORS/Network**: Ensure UE5 machine can reach the API host (default `localhost:9002`). If running UE5 on a different machine, use the API server's LAN IP.
- **Z-Height Mismatch**: Cesium real-world terrain uses georeferenced coordinates. If FluidFlux is placed at local 0, ensure it aligns with the sea level of the Cesium tiles.
