#!/usr/bin/env python3
"""
Generate cities-by-country.json from GeoNames cities1000 dataset.
Top 20 cities per country by population. Output for web app.
"""
import json
import urllib.request
import zipfile
import io
import os

GEONAMES_URL = "https://download.geonames.org/export/dump/cities1000.zip"
OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "apps", "web", "public", "data", "cities-by-country.json"
)
MAX_CITIES_PER_COUNTRY = 20


def main():
    print("Downloading GeoNames cities1000.zip...")
    with urllib.request.urlopen(GEONAMES_URL, timeout=60) as resp:
        data = resp.read()

    print("Extracting...")
    with zipfile.ZipFile(io.BytesIO(data), "r") as zf:
        with zf.open("cities1000.txt") as f:
            lines = f.read().decode("utf-8", errors="ignore").splitlines()

    # Format: geonameid, name, asciiname, alternatenames, latitude, longitude,
    # feature class, feature code, country code, cc2, admin1, admin2, admin3, admin4,
    # population, elevation, dem, timezone, modification date
    by_country: dict[str, list[dict]] = {}
    for line in lines:
        parts = line.split("\t")
        if len(parts) < 15:
            continue
        cc = parts[8]
        name = parts[1]
        lat = float(parts[4])
        lng = float(parts[5])
        pop = int(parts[14]) if parts[14] else 0

        if cc not in by_country:
            by_country[cc] = []
        by_country[cc].append({
            "id": f"{cc}-{parts[0]}",
            "name": name,
            "lat": round(lat, 4),
            "lng": round(lng, 4),
            "population": pop,
        })

    # Sort by population desc, take top N
    result: dict[str, list[dict]] = {}
    for cc, cities in by_country.items():
        sorted_cities = sorted(cities, key=lambda c: c["population"], reverse=True)
        result[cc] = sorted_cities[:MAX_CITIES_PER_COUNTRY]

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))

    total = sum(len(v) for v in result.values())
    print(f"Wrote {OUTPUT_PATH}: {len(result)} countries, {total} cities total")


if __name__ == "__main__":
    main()
