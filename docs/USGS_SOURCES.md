# USGS Data Sources Used by the Platform

A concise summary of official USGS sources used by platform modules (including the Flood Risk Model), with links to documentation and programs.

---

## 3D Elevation Program (3DEP)

- **Program:** [USGS 3D Elevation Program](https://www.usgs.gov/3d-elevation-program) — federal lidar and DEM program; ~98% coverage of the United States; applications: flood risk management, hydrologic modeling, FEMA, infrastructure.
- **Official strategy (Next Generation):** [USGS Circular 1553](https://pubs.usgs.gov/circ/1553/cir1553.pdf) — The 3D National Topography Model Call for Action, Part 2: The Next Generation 3D Elevation Program (version 1.1, July 2025).
- **Platform usage:** terrain for FloodHydrologyEngine (slope, profile). Point elevation access via the Elevation Point Query Service (EPQS).

---

## Elevation Point Query Service (EPQS)

- **Purpose:** returns elevation at a given point (lat/lon) from 3DEP data (DEM interpolation).
- **Documentation and data download:** [The National Map — GIS Data Download](https://www.usgs.gov/the-national-map-data-delivery/gis-data-download) (National Map Downloader, LidarExplorer, tools).
- **API (single point):** `https://epqs.nationalmap.gov/v1/json` — parameters `x` (lon), `y` (lat), `units=Meters`. Documentation: [epqs.nationalmap.gov/v1/docs](https://epqs.nationalmap.gov/v1/docs).
- **Interactive interface:** [apps.nationalmap.gov/epqs/](https://apps.nationalmap.gov/epqs/).
- **Bulk queries (extension):** [Bulk Point Query Service](https://apps.nationalmap.gov/bulkpqs/) — for multiple points without a series of single calls.
- **Code:** `apps/api/src/services/external/usgs_elevation_client.py` — uses EPQS (single points and profile over a grid).

---

## NWIS and WaterWatch (streamflow)

- **Streamflow data:** [USGS National Water Information System (NWIS)](https://doi.org/10.5066/F7P55KJN) — archive and real-time data from gaging stations (National Streamgage Network). Used for calibration/context in the flood model.
- **Maps and reports:** [WaterWatch](https://waterwatch.usgs.gov/) — streamflow and drought condition maps, comparison with history. Water year summaries and maps: [Water Year Summary](https://waterwatch.usgs.gov/publications/wysummary/2022/) (example for 2022).
- **API:** `https://waterservices.usgs.gov/nwis/site/` and `.../nwis/iv/` — site search by bbox, instantaneous values (discharge, gage height).
- **Code:** `apps/api/src/services/external/usgs_waterwatch_client.py` — streamflow data via NWIS; maps and water year summaries at waterwatch.usgs.gov.

---

## Future extensions

- **Bulk Point Query:** reduce the number of requests for `get_elevation_profile` by using the [Bulk Point Query Service](https://apps.nationalmap.gov/bulkpqs/) (many points in one request).
- **TNM Access API:** [TNM Access API](https://apps.nationalmap.gov/tnmaccess) — access to National Map datasets, including selection of lidar projects by bbox when finer DEM is needed.

---

*In repository: `docs/USGS_SOURCES.md`.*
