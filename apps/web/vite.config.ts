import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
  ],
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
    strictPort: true,
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
    chunkSizeWarningLimit: 3000,
  },
})
