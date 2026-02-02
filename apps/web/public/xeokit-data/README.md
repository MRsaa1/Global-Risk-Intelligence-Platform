# xeokit BIM Viewer data (XKT)

This folder holds projects and XKT models for the integrated xeokit-bim-viewer (BIM XKT tab on Asset detail).

## Structure

```
xeokit-data/
  projects/
    index.json          ← list of projects (id, name)
    Duplex/
      index.json        ← project config, models list, viewerContent
      models/
        design/
          geometry.xkt  ← XKT file (create via conversion, see below)
```

## How to add a model

### Option A: Script (download IFC + convert)

From **repo root**:

```bash
chmod +x scripts/convert-ifc-to-xkt.sh
./scripts/convert-ifc-to-xkt.sh MyBuilding
```

Then add `MyBuilding` to `projects/index.json` in the `projects` array (copy the Duplex entry and change id/name).

### Option B: Manual (you already have an IFC file)

1. **Convert IFC → XKT** — use the **full path** to your IFC file (not just `model.ifc`):

   From **repo root**:
   ```bash
   # Create folder
   mkdir -p apps/web/public/xeokit-data/projects/MyBuilding/models/design

   # Convert (replace /path/to/your/model.ifc with real path)
   npx @xeokit/xeokit-convert -s /path/to/your/model.ifc -o apps/web/public/xeokit-data/projects/MyBuilding/models/design/geometry.xkt
   ```

   Or if the IFC is in the project (e.g. `apps/web/public/samples/demo.ifc`):
   ```bash
   npx @xeokit/xeokit-convert -s "$(pwd)/apps/web/public/samples/demo.ifc" -o "$(pwd)/apps/web/public/xeokit-data/projects/MyBuilding/models/design/geometry.xkt"
   ```
   - Or use [Creoox IFC → GLB converter](https://github.com/Creoox/creoox-ifc2gltfcxconverter) then convert GLB → XKT if needed.

2. **Add project to index**  
   Edit `projects/index.json` and add your project:
   ```json
   { "id": "MyProject", "name": "My Project" }
   ```

3. **Add project folder**  
   Create `projects/MyProject/index.json` (see `Duplex/index.json` as template) and `projects/MyProject/models/design/geometry.xkt`.

4. **Open in app**  
   On Asset detail, open the **BIM (XKT)** tab and set the project ID (e.g. from asset metadata or default "Duplex"). The viewer loads from `/xeokit-data`.

## Demo (Duplex)

To get the Duplex demo model, run from project root:

```bash
mkdir -p apps/web/public/xeokit-data/projects/Duplex/models/design
# Then convert an IFC Duplex sample to XKT, e.g.:
# npx @xeokit/xeokit-convert -s path/to/Duplex.ifc -o apps/web/public/xeokit-data/projects/Duplex/models/design/geometry.xkt
```

Or download a pre-converted XKT from the [xeokit-bim-viewer repo](https://github.com/xeokit/xeokit-bim-viewer/tree/master/app/data/projects/Duplex/models/design) and save as `geometry.xkt` in the path above.
