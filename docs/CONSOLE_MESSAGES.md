# Console messages and how we handle them

This doc explains common browser-console messages you may see when running the web app and what (if anything) to do about them.

## From browser extensions (safe to ignore)

- **`inject.js: Port connected`** – From a browser extension (e.g. wallet, dev tools). Not from the app.
- **`[Violation] Permissions policy violation: unload is not allowed`** – Extension script; not from the app.
- **`lockdown-install.js: SES Removing unpermitted intrinsics`** – Extension (e.g. MetaMask). Safe to ignore.

## From the app

### IFC / BIM viewer

- **`IFC Load Error: TypeError: Missing field: "LINEWRITER_BUFFER"`**  
  This happened when the IFC loader received non-IFC data (e.g. an HTML 404 page from a demo URL). We now:
  - Check that the response is OK and non-empty before parsing.
  - Validate that the buffer starts with `ISO-10303-21` (IFC STEP header) before calling `web-ifc`’s `OpenModel`.  
  If a demo URL still fails, you’ll get a clearer error like *“File is not a valid IFC…”* or *“Demo unavailable (404)…”*. Use another demo preset or upload a local `.ifc` file.

- **`THREE.WebGLRenderer: Context Lost`**  
  The WebGL context was lost (e.g. tab in background, GPU busy, too many 3D tabs). We now:
  - Listen for `webglcontextlost` / `webglcontextrestored` in the BIM viewer Canvas.
  - Show an overlay: “WebGL context lost — refresh the page or close other heavy 3D tabs.”  
  Refreshing the page or closing other 3D apps usually restores it.

### Zustand deprecation

- **`[DEPRECATED] Default export is deprecated. Instead use import { create } from 'zustand'`**  
  Our code already uses the named import: `import { create } from 'zustand'` in `platformStore.ts` and `collaborationStore.ts`. This warning comes from a **dependency** (e.g. `@react-three/fiber` or `@react-three/drei`) that still uses the old default export. It does not affect behavior and will go away when those packages update. No change needed in this repo.

### React DevTools

- **`Download the React DevTools for a better development experience`**  
  Optional: install the React DevTools browser extension for easier debugging.

## Summary

| Message                         | Source        | Action                          |
|---------------------------------|---------------|----------------------------------|
| inject.js / lockdown-install   | Extensions    | Ignore                           |
| LINEWRITER_BUFFER               | App (fixed)   | Use valid IFC or local demo      |
| WebGL Context Lost             | App (handled) | Overlay shown; refresh if needed |
| Zustand default export         | Dependency    | Ignore until deps update         |
| React DevTools                 | React         | Optional: install extension      |
