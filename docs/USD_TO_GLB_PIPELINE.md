## USD → GLB pipeline (for web rendering)

### Why
- **USD/OpenUSD** is our canonical master format (Omniverse).
- **Web** viewers (Three.js) typically consume **GLB**.

### MVP implementation in this repo
Backend endpoint:
- `POST /api/v1/twin-assets/{item_id}/convert`

What it does:
1. reads `usd_path` (dev: local file or object storage key),
2. runs `usd2gltf` to generate `model.glb`,
3. uploads `model.glb` to MinIO (`assets/twins/library/<id>/model.glb`),
4. writes `glb_object` back into the catalog row.

### Requirements
This conversion is optional and enabled only if the API environment has:
- `usd2gltf` in PATH
- `usd-core` installed (Pixar USD bindings)

In this repo it’s declared as an optional dependency group in `apps/api/pyproject.toml` (`[project.optional-dependencies].usd`).

### Enterprise note (Nucleus / Omniverse paths)
If `usd_path` points to Nucleus (for example under `/Library/...` or `omniverse://...`), you typically run conversion inside an Omniverse/Kit worker that can read from Nucleus and write results to object storage.

