import argparse
import json
import os
import requests
from typing import Dict, Any

# Default API URL (assuming local development)
DEFAULT_API_URL = "http://localhost:9002/api/v1"

def fetch_json(url: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    """Fetch JSON data from a URL with optional parameters."""
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching {url}: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Fetch disaster scenarios for Unreal Engine 5.")
    parser.add_argument("--scenario-id", required=True, help="ID of the high-fidelity scenario to fetch (e.g., wrf_nyc_202501).")
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="Base URL of the Platform API.")
    parser.add_argument("--output-dir", default="./ue5_scenario", help="Directory to save JSON files.")
    
    args = parser.parse_args()
    
    # Ensure output directory exists
    os.makedirs(args.output_dir, exist_ok=True)
    print(f"Fetching scenario '{args.scenario_id}' from {args.api_url}...")
    print(f"Saving to {args.output_dir}...")

    # 1. Fetch Metadata
    meta_url = f"{args.api_url}/climate/high-fidelity/metadata"
    metadata = fetch_json(meta_url, params={"scenario_id": args.scenario_id})
    if metadata:
        with open(os.path.join(args.output_dir, "metadata.json"), "w") as f:
            json.dump(metadata, f, indent=2)
        print("✅ Saved metadata.json")
    else:
        print("❌ Failed to fetch metadata (Scenario ID might be invalid)")
        return

    # 2. Fetch Flood Data
    flood_url = f"{args.api_url}/climate/high-fidelity/flood"
    flood_data = fetch_json(flood_url, params={"scenario_id": args.scenario_id})
    if flood_data:
        with open(os.path.join(args.output_dir, "flood.json"), "w") as f:
            json.dump(flood_data, f, indent=2)
        print("✅ Saved flood.json")
    else:
        print("⚠️ Failed to fetch flood data")

    # 3. Fetch Wind Data
    wind_url = f"{args.api_url}/climate/high-fidelity/wind"
    wind_data = fetch_json(wind_url, params={"scenario_id": args.scenario_id})
    if wind_data:
        with open(os.path.join(args.output_dir, "wind.json"), "w") as f:
            json.dump(wind_data, f, indent=2)
        print("✅ Saved wind.json")
    else:
        print("⚠️ Failed to fetch wind data")

    print("\nDone! Import these files into your UE5 project.")

if __name__ == "__main__":
    main()
