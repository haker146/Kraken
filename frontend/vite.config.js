import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // When built, QWebEngineView loads index.html from dist/
  // For dev, proxy API calls to the Python backend
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:7734',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../sff/webui_react',
    emptyOutDir: true,
  },
})
