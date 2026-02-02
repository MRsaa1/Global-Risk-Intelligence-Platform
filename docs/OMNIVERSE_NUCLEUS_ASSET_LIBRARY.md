## Omniverse / OpenUSD asset library (Nucleus) — how we structure the “base”

### What this is
We treat **OpenUSD** as the *canonical* (“master”) format for enterprise Digital Twins:
- Composition, layering, variants (scenarios / LOD / materials)
- Multi-user collaboration (Omniverse)

Our **web product** (Three.js) does **not** consume USD directly. For the web we publish *derived* assets:
- `GLB` for a single factory/building/asset
- `3D Tiles` for city-scale blocks/terrain (Cesium-native)

### Nucleus folder structure (recommended)
This folder tree makes it easy to:
- seed a base library,
- build a catalog/index in our API,
- attach a model to `Asset`/`Project`.

```
/Library
  /City
    /Blocks
    /Buildings
    /Infrastructure
    /Materials
  /Factory
    /Plants
    /Equipment
    /Utilities
    /Materials
  /Finance
    /Banking
    /Insurance
    /Exchanges

/Projects
  /<client_or_program>
    /<project_id_or_name>
      /Scenes
      /Assets
      /Exports
```

### Naming conventions (simple, scalable)
- USD master: `*.usd` / `*.usdz` / `*.usdc` under `/Library/...` or `/Projects/...`
- Derived web export: `*.glb` stored in MinIO `assets/` bucket (path recorded in our DB catalog)
- Thumbnails: `*.webp` / `*.png` stored in MinIO next to `glb`

### How this connects to our platform (implementation)
- **Digital Twin geometry pointer** lives in `DigitalTwin.geometry_path` and `DigitalTwin.geometry_type`
  - `geometry_type`: `usd` or `glb` (and later: `tileset`)
  - `geometry_path`: points to MinIO object key (for web) and/or Nucleus path (for Omniverse)

### Content sourcing strategy (practical)
To build a “real” base (not chairs/tables), we recommend a mixed strategy:
- **NVIDIA Omniverse sample packs + Blueprints** for factory/city reference assets
- **BIM/IFC** from clients (factories, ports, data centers) → converted to USD and layered
- **Open city data**: OSM footprints / Cesium 3D Tiles for city-scale context; USD only for “focus assets”

### Operational note
Nucleus deployment and content ingestion is environment-specific (local vs server).
In our codebase we keep it configurable via env vars:
- `ENABLE_NUCLEUS`
- `NUCLEUS_URL`
- `NUCLEUS_LIBRARY_ROOT`
- `NUCLEUS_PROJECTS_ROOT`

