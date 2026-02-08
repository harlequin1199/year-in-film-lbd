import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react'
          }
          if (
            id.includes('LazyChartsSection') ||
            id.includes('TimelineChart') ||
            id.includes('ByYearChart')
          ) {
            return 'vendor-charts'
          }
          if (id.includes('FavoriteDecades')) {
            return 'vendor-decades'
          }
        },
      },
    },
    minify: 'esbuild',
    esbuild: {
      drop: ['console', 'debugger'],
    },
  },
})
