import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces — Pi serves the dev frontend; clients on the
    // LAN (Mac, iPad, demo laptop) all hit it on port 5173.
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Forward /ws to the FastAPI backend on the same machine. This way the
    // frontend code uses a *relative* WebSocket URL and works regardless of
    // which IP/host the page was loaded from (10.10.1.116, tourbox-coach.local,
    // localhost, etc.).
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
