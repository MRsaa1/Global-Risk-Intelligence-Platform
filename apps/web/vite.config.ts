import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
  ],
  // Avoid 504 (Outdated Optimize Dep): pre-bundle core deps; exclude html2canvas so it's in-chunk.
  // Do NOT use force: true — it re-optimizes every start and causes 504 when the browser has stale refs.
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      '@tanstack/react-query',
    ],
    exclude: ['html2canvas'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Prevent bundling multiple copies of Three.js (breaks instanceof checks, warnings).
    dedupe: ['three'],
  },
  server: {
    port: 5180,
    host: '127.0.0.1',
    strictPort: false, // if 5180 is in use, Vite will try 5181, 5182, ...
    // Pre-transform entry and lazy routes so deps are ready and 504 is less likely
    warmup: {
      clientFiles: ['./index.html', './src/main.tsx', './src/App.tsx', './src/pages/Dashboard.tsx', './src/pages/Assets.tsx'],
    },
    hmr: {
      protocol: 'ws',
      // Use IPv4 explicitly to avoid macOS localhost(::1) ECONNRESET/ECONNREFUSED issues
      host: '127.0.0.1',
      port: 5180,
      clientPort: 5180,
    },
    watch: {
      usePolling: true,
    },
    // /api and /api/v1/ws/connect → localhost:9002. Run API: cd apps/api && source .venv/bin/activate && uvicorn src.main:app --host 0.0.0.0 --port 9002 --reload
    proxy: {
      '/api': {
        // Use IPv4 explicitly to avoid AggregateError[ECONNREFUSED] on localhost(::1)
        target: 'http://127.0.0.1:9002',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err: NodeJS.ErrnoException) => {
            if (['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT'].includes(err?.code || '')) {
              console.warn('[vite] api proxy: %s (is API on :9002 running? Start with: cd apps/api && uvicorn src.main:app --host 0.0.0.0 --port 9002 --reload)', err.code)
            } else {
              console.error('[vite] api proxy error:', err)
            }
          })
        },
      },
    },
  },
  preview: {
    port: 5180,
    host: true,
    allowedHosts: ['risk.saa-alliance.com', 'localhost', '.brevlab.com'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9002',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/cesium')) return 'cesium'
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) return 'charts'
          if (id.includes('node_modules/plotly.js') || id.includes('react-plotly.js')) return 'plotly'
          if (id.includes('node_modules/deck.gl') || id.includes('@deck.gl')) return 'deck'
          if (id.includes('node_modules/maplibre') || id.includes('react-map-gl')) return 'map'
          if (id.includes('node_modules/@xeokit') || id.includes('web-ifc')) return 'bim'
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: { provider: 'v8', reporter: ['text', 'json-summary'], exclude: ['node_modules/', 'src/test/'] },
  },
})
