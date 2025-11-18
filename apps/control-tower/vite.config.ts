import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 9010,  // Changed to 9010 (9000 is occupied by MinIO)
    proxy: {
      '/api': {
        target: 'http://localhost:9002',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path, // Keep /api prefix
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
        },
      },
    },
  },
});

