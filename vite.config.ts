import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['xopuxw-ip-114-143-75-118.tunnelmole.net'],
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: ['xopuxw-ip-114-143-75-118.tunnelmole.net'],
  },
  optimizeDeps: {
    exclude: ['@mediapipe/face_mesh'],
  },
})
