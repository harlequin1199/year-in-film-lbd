import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 2,
        functions: 35,
        branches: 45,
        statements: 2,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react'
          }
          if (
            id.includes('LazyChartsSection') ||
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
