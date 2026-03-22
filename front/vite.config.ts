import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    // иначе запросы с IP/домена (не localhost) режет host-check в Vite 8
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
})
