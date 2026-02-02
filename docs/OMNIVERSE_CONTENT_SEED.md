## Seeding the Digital Twin “base” (content packs + city context)

### Goal
Build a usable starter library for:
- factories (plants/equipment/utilities),
- city blocks (context + infrastructure),
- finance buildings (generic placeholders until client BIM arrives),
stored as **USD masters in Nucleus** and **GLB/3D Tiles derivatives** for the web.

### What we seed in code (this repo)
We ship a dev/demo endpoint that seeds *catalog rows* (metadata + Nucleus paths):
- `POST /api/v1/seed/twin-assets` (admin only; disabled in prod)

This does **not** download gigabytes of content automatically; download/import is environment-specific.

### Recommended content sources
- **NVIDIA Omniverse “Downloadable Asset Packs” (OpenUSD)**: use as initial “SimReady” primitives.
- **Omniverse Blueprints (Factory / Smart City AI)**: use as reference assemblies and best-practice templates.
- **City-scale**: prefer **3D Tiles** (Cesium) or OSM footprints for context; keep USD for focus assets only.
- **Client BIM/IFC**: your “real factories / ports / plants” should come from clients and be converted to USD.

### Practical workflow (mixed: Omniverse + web)
1. Install/launch **Nucleus**, create the folder structure from `docs/OMNIVERSE_NUCLEUS_ASSET_LIBRARY.md`.
2. Import USD packs into `/Library/...`.
3. Run `POST /api/v1/seed/twin-assets` to create the catalog rows.
4. Convert selected USD masters to GLB (worker/pipeline step) and store derivatives in MinIO.
5. Attach a catalog item to an `Asset` (our API sets `DigitalTwin.geometry_path/type`), then view it in `Present`.

