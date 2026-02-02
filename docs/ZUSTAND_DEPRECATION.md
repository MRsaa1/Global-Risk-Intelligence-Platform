# Zustand deprecation warning

## Source

The zustand deprecation warning in the console comes from **transitive dependencies**, not from our store code:

- **@react-three/fiber** depends on `zustand ^3.7.1` (old API).
- **@react-three/drei** depends on `zustand ^5.0.1`.

Our code uses the recommended API: `import { create } from 'zustand'` in `platformStore.ts` and `collaborationStore.ts`.

## Fix applied

- **package.json**: zustand upgraded to `^5.0.0` and `overrides` set to `"zustand": "^5.0.0"` so all packages (including fiber/drei) use a single zustand 5. Our stores are v5-compatible (no default export, no deprecated patterns).
- Run **`npm install`** in `apps/web` after pulling. If anything breaks with fiber, you can revert to `"zustand": "^4.5.7"` and live with the warning until dependencies update.
