#!/usr/bin/env python3
"""
Fetch high-fidelity scenario (flood, wind, metadata) from the platform API and save
as JSON files for UE5. Use before opening the level in UE5, or call from UE5 via
Execute Console Command / external tool.

Usage (from repo root; API must be running on port 9002):
  python scripts/ue5_fetch_scenario.py --scenario-id wrf_nyc_001
  python scripts/ue5_fetch_scenario.py --scenario-id wrf_nyc_001 --output-dir ./ue5_scenario
  python scripts/ue5_fetch_scenario.py --api-base http://127.0.0.1:9002/api/v1 --scenario-id wrf_nyc_001

Output: {output_dir}/flood.json, wind.json, metadata.json (same format as API responses).
"""
import argparse
import json
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def fetch_json(url: str) -> dict:
    req = Request(url, headers={"Accept": "application/json"})
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser(description="Fetch high-fidelity scenario for UE5")
    ap.add_argument(
        "--api-base",
        default="http://localhost:9002/api/v1",
        help="API base URL (default: http://localhost:9002/api/v1)",
    )
    ap.add_argument("--scenario-id", required=True, help="Scenario ID (e.g. wrf_nyc_001)")
    ap.add_argument(
        "--output-dir",
        default="./ue5_scenario",
        help="Output directory for flood.json, wind.json, metadata.json (default: ./ue5_scenario)",
    )
    args = ap.parse_args()

    base = args.api_base.rstrip("/")
    sid = args.scenario_id
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        flood_url = f"{base}/climate/high-fidelity/flood?scenario_id={sid}"
        wind_url = f"{base}/climate/high-fidelity/wind?scenario_id={sid}"
        meta_url = f"{base}/climate/high-fidelity/metadata?scenario_id={sid}"

        flood = fetch_json(flood_url)
        (out_dir / "flood.json").write_text(json.dumps(flood, indent=2), encoding="utf-8")
        print(f"Wrote {out_dir / 'flood.json'}")

        wind = fetch_json(wind_url)
        (out_dir / "wind.json").write_text(json.dumps(wind, indent=2), encoding="utf-8")
        print(f"Wrote {out_dir / 'wind.json'}")

        meta = fetch_json(meta_url)
        (out_dir / "metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
        print(f"Wrote {out_dir / 'metadata.json'}")

        print(f"Scenario {sid} saved to {out_dir.absolute()}")
        return 0
    except HTTPError as e:
        print(f"HTTP error: {e.code} {e.reason}", file=sys.stderr)
        if e.code == 404:
            print(f"Scenario not found: {sid}. Run seed or ETL first.", file=sys.stderr)
        return 1
    except URLError as e:
        print(f"Request failed: {e.reason}", file=sys.stderr)
        print("Ensure the API is running (e.g. ./run-on-mac.sh or uvicorn on port 9002).", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
