# IFC demo sample

To make the **Local demo** preset work in the BIM Viewer, download a small IFC file into this folder.

**If you get `cd: no such file or directory: apps/web/public/samples`** — you're not in the project root. Go to the project first (the folder that contains `apps/`), then run the commands below.

### Step 1: Go to the project root

```bash
cd ~/global-risk-platform
```

(If your project is elsewhere, use that path, e.g. `cd ~/projects/global-risk-platform`.)

### Step 2: Download the demo IFC

```bash
cd apps/web/public/samples && curl -L -o demo.ifc "https://raw.githubusercontent.com/andrewisen/bim-whale-ifc-samples/main/BasicHouse/IFC/BasicHouse.ifc"
```

Or as a single line from anywhere (replace with your actual project path if different):

```bash
cd ~/global-risk-platform && cd apps/web/public/samples && curl -L -o demo.ifc "https://raw.githubusercontent.com/andrewisen/bim-whale-ifc-samples/main/BasicHouse/IFC/BasicHouse.ifc"
```

Then open the BIM Viewer and click **Local demo**. This avoids CORS issues with external URLs.
