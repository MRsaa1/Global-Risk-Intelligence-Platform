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
  },
  server: {
    port: 5180,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:9002',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5180,
    host: true,
    allowedHosts: ['risk.saa-alliance.com', 'localhost'],
  },
  build: {
    chunkSizeWarningLimit: 3000,
  },
})
