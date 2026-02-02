# ETL High-Fidelity (WRF / ADCIRC → Platform JSON)

Converts WRF and ADCIRC outputs into the platform’s high-fidelity JSON format.  
Outputs are read by the API at `GET /api/v1/climate/high-fidelity/flood` and `.../wind`.

## Output format

Per scenario ID, the ETL writes under `{HIGH_FIDELITY_STORAGE_PATH}/{scenario_id}/`:

- **flood.json** — `HighFidelityFloodPayload` (same shape as `FloodForecastResponse`)
- **wind.json** — `HighFidelityWindPayload` (WRF only; same shape as `WindForecastResponse`)
- **metadata.json** — `HighFidelityScenarioMetadata` (scenario_id, model, run_time, bbox, resolution)

## Running the ETL

From `apps/api`:

```bash
cd apps/api
export PYTHONPATH=src
```

**WRF (flood + wind):**

```bash
python -m scripts.etl_high_fidelity.wrf_to_platform --scenario_id wrf_nyc_001 --center-lat 40.71 --center-lon -74.01
# With NetCDF input:
python -m scripts.etl_high_fidelity.wrf_to_platform --scenario_id wrf_nyc_001 --input /path/to/wrfout_d01.nc --center-lat 40.71 --center-lon -74.01
```

**ADCIRC (flood/surge only):**

```bash
python -m scripts.etl_high_fidelity.adcirc_to_platform --scenario_id adcirc_nyc_001 --center-lat 40.71 --center-lon -74.01
# With NetCDF input (e.g. maxele.63.nc, fort.63.nc):
python -m scripts.etl_high_fidelity.adcirc_to_platform --scenario_id adcirc_nyc_001 --input /path/to/maxele.63.nc --center-lat 40.71 --center-lon -74.01
```

## Seed demo scenario

To get at least one scenario ID from `GET /api/v1/climate/high-fidelity/scenarios`, run the seed script once (from `apps/api`, with `PYTHONPATH=src`):

```bash
cd apps/api
export PYTHONPATH=src
python -m scripts.seed_high_fidelity
```

This creates `data/high_fidelity/wrf_nyc_001/` with `flood.json`, `wind.json`, and `metadata.json`. The API loader reads from the same path by default (see **Paths** below).

## Configuration

- **HIGH_FIDELITY_STORAGE_PATH** — Local directory for output (default: `apps/api/data/high_fidelity`).
- **HIGH_FIDELITY_S3_BUCKET** — If set, scripts can upload to S3 (optional; not implemented in this stub).
- **--output-dir** — Override output directory for a single run.

## Paths (ETL and API)

- **ETL** (this package): when `HIGH_FIDELITY_STORAGE_PATH` is unset, output is written to `apps/api/data/high_fidelity/{scenario_id}/`.
- **API** (`high_fidelity_loader`): when `high_fidelity_storage_path` is unset, it reads from `apps/api/data/high_fidelity/`. So ETL and API use the same default path; no extra config is needed for local development.

## After WRF/ADCIRC on HPC

1. Copy or mount WRF/ADCIRC output (NetCDF or FME-converted files) to a path the ETL can read.
2. Run the appropriate script (`wrf_to_platform` or `adcirc_to_platform`) with `--scenario_id` and `--input` (and optionally `--center-lat`, `--center-lon`).
3. Point the API’s high-fidelity loader at the same storage (local path or S3). See `HIGH_FIDELITY_STORAGE_PATH` in the API config.

Optional: wrap in a job script or cron that runs after your WRF/ADCIRC job completes.

## Dependencies

- **Required:** Python 3.11+, Pydantic (from the API project).
- **Optional (for real NetCDF):** `xarray`, `netCDF4`, `numpy`. Install with `pip install xarray netCDF4` if you need to read WRF/ADCIRC NetCDF files.
