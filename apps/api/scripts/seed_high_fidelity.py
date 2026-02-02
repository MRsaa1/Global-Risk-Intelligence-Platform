#!/usr/bin/env python3
"""
Seed high-fidelity demo scenarios for multiple cities.
Each scenario writes flood.json, wind.json, metadata.json to data/high_fidelity/{scenario_id}/.

Run from apps/api with: PYTHONPATH=src python -m scripts.seed_high_fidelity
"""
import sys
from pathlib import Path

# Ensure src is on path so etl_high_fidelity can import schemas
_api_root = Path(__file__).resolve().parents[1]
_src = _api_root / "src"
if str(_src) not in sys.path:
    sys.path.insert(0, str(_src))

from scripts.etl_high_fidelity.config import get_output_dir
from scripts.etl_high_fidelity.wrf_to_platform import run

# High-fidelity scenarios for different cities
SCENARIOS = [
    {"id": "wrf_nyc_001", "name": "New York", "lat": 40.71, "lon": -74.01},
    {"id": "wrf_miami_001", "name": "Miami", "lat": 25.76, "lon": -80.19},
    {"id": "wrf_tokyo_001", "name": "Tokyo", "lat": 35.68, "lon": 139.65},
    {"id": "wrf_london_001", "name": "London", "lat": 51.51, "lon": -0.13},
    {"id": "wrf_shanghai_001", "name": "Shanghai", "lat": 31.23, "lon": 121.47},
    {"id": "wrf_mumbai_001", "name": "Mumbai", "lat": 19.08, "lon": 72.88},
    {"id": "wrf_jakarta_001", "name": "Jakarta", "lat": -6.21, "lon": 106.85},
    {"id": "wrf_dhaka_001", "name": "Dhaka", "lat": 23.81, "lon": 90.41},
]


def main() -> None:
    seeded = 0
    skipped = 0
    for scenario in SCENARIOS:
        scenario_id = scenario["id"]
        output_dir = get_output_dir(scenario_id)
        output_dir.mkdir(parents=True, exist_ok=True)
        if (output_dir / "flood.json").exists():
            print(f"  [skip] {scenario_id} ({scenario['name']}) already exists")
            skipped += 1
            continue
        run(scenario_id, None, scenario["lat"], scenario["lon"], output_dir)
        print(f"  [seed] {scenario_id} ({scenario['name']})")
        seeded += 1
    print(f"\nDone: {seeded} seeded, {skipped} skipped")
    print("GET /api/v1/climate/high-fidelity/scenarios will now return all scenario IDs")


if __name__ == "__main__":
    main()
