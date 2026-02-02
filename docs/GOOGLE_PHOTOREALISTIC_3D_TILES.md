# Google Photorealistic 3D Tiles in CesiumJS

This project uses **Google Photorealistic 3D Tiles** in two places:

1. **Digital Twin panel** – city-level 3D (all cities use Google Photorealistic when the panel is open).
2. **Command Center globe** – optional “Google 3D” layer toggle (replaces OSM buildings on the main globe).

## Implementation

- **Preferred API (CesiumJS 1.124+):** `Cesium.createGooglePhotorealistic3DTileset(options)` when available.
- **Fallback:** `Cesium.Cesium3DTileset.fromIonAssetId(2275207, options)` (Cesium Ion Asset #2275207).

No Google API key is required when using Cesium Ion as the proxy.

## Setup

1. **Cesium Ion**
   - Go to [Cesium Ion](https://ion.cesium.com/), add asset **Google Photorealistic 3D Tiles** (ID: 2275207), accept terms.
   - The app uses `CESIUM_TOKEN` in `DigitalTwinPanel.tsx` and `CesiumGlobe.tsx`; ensure your Ion account has access to asset #2275207.

2. **CesiumJS version**
   - Use **cesium@1.124+** for `createGooglePhotorealistic3DTileset()` (see [CesiumJS Photorealistic 3D Tiles](https://cesium.com/learn/cesiumjs-learn/cesiumjs-photorealistic-3d-tiles)).

## Behavior

- **Digital Twin:** All cities use Google Photorealistic 3D Tiles when the panel is open (not picker mode). LOD is tuned for close-up; fallback is Cesium OSM Buildings.
- **Globe:** In Command Center, the “Google 3D” checkbox in the layers panel switches the globe’s 3D buildings from OSM to Google Photorealistic (and back).

## Unreal Engine → CesiumJS mapping

If you follow a tutorial for **Cesium for Unreal** (Unreal Engine plugin), here is the equivalent in **CesiumJS** (web):

| Unreal / Cesium for Unreal | CesiumJS (this project) |
|----------------------------|-------------------------|
| Add Cesium World Terrain | `Cesium.CesiumTerrainProvider.fromIonAssetId(1)` or default ellipsoid |
| Add Google Photorealistic 3D Tiles (Unreal actor/component) | `Cesium.createGooglePhotorealistic3DTileset()` or `Cesium.Cesium3DTileset.fromIonAssetId(2275207)` then `viewer.scene.primitives.add(tileset)` |
| Set Cesium Ion access token (Unreal project settings) | `Cesium.Ion.defaultAccessToken = '...'` or token in Viewer options |
| Georeference / origin (Unreal) | Not needed; CesiumJS viewer uses WGS84 by default |
| Fly to location (Unreal Blueprint) | `viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lng, lat, height), ... })` |
| Toggle 3D Tiles visibility (Unreal) | `tileset.show = true/false` or add/remove from `viewer.scene.primitives` |
| Google Maps API key (direct API) | Optional; Cesium Ion proxy avoids key for Photorealistic 3D Tiles |

The Unreal workflow (add terrain, add 3D Tiles, set token, fly to location) maps directly to creating a `Viewer`, adding the tileset to `scene.primitives`, and using `camera.flyTo`.

## Alternative: Direct Google Map Tiles API

For direct Google API (API key, billing, allowlist):

- Set `VITE_GOOGLE_MAPS_3DTILES_KEY` in `apps/web/.env` and extend the code to use the direct endpoint.
- For most users, the Cesium Ion approach is simpler and avoids 403/EEA restrictions.

## References

- [CesiumJS Photorealistic 3D Tiles](https://cesium.com/learn/cesiumjs-learn/cesiumjs-photorealistic-3d-tiles)
- [Google Photorealistic 3D Tiles - Cesium Ion](https://ion.cesium.com/)
- [Google Map Tiles API - Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles)
