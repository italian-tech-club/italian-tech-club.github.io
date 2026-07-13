import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Important for GitHub Pages if not using a custom domain at root, but we'll see. Usually repo name.
  server: {
    host: true, // bind 0.0.0.0 so other devices on the LAN can connect
    proxy: {
      // In dev the frontend uses relative /api URLs (VITE_API_URL unset),
      // so API calls work from any device — vite forwards them to the
      // local express server.
      '/api': 'http://localhost:3001',
    },
  },
})
