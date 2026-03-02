# Performance baseline

Reference for chunk size budget and first interactive render (TTI) targets.

## Chunk size budget

- **Limit:** No single JS chunk in `dist/assets/*.js` may exceed **2 MB** after `npm run build`.
- **Enforcement:** The script `apps/web/scripts/check-chunk-size.mjs` runs after `vite build` and fails the build if any chunk exceeds the limit.
- **Vite config:** `apps/web/vite.config.ts` sets `chunkSizeWarningLimit: 1500` (kB) and `manualChunks` to split heavy dependencies (Cesium, Three.js, recharts/plotly, deck.gl, map libs, BIM) into separate chunks. Adjust `manualChunks` if new heavy deps are added.

## First interactive render (TTI)

- **Target screens:** Command Center (`/command`), Map (globe/canvas), Stress Planner (`/stress-planner`).
- **Baseline:** Measure TTI (e.g. Lighthouse "Time to Interactive" or custom mark) for these routes and record below. Re-measure after major frontend or dependency changes.

| Route           | TTI target | Last measured (date / env) |
|-----------------|------------|-----------------------------|
| /command        | < 10 s     | _to be filled_              |
| /stress-planner | < 8 s      | _to be filled_              |

- **Optional CI:** To enforce TTI in CI, add a step that runs `npx lighthouse ... --assertions` with thresholds (see Lighthouse CI). Not required for the initial baseline.

## References

- Vite build config: `apps/web/vite.config.ts`
- Chunk check script: `apps/web/scripts/check-chunk-size.mjs`
