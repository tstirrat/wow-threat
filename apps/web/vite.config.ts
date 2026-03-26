import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

const getVendorChunkName = (id: string): string | undefined => {
  if (
    /\/apps\/web\/src\/routes\/report-layout\.tsx$/.test(id) ||
    /\/apps\/web\/src\/pages\/report-page\.tsx$/.test(id)
  ) {
    return 'report-page'
  }

  if (
    /\/packages\/config\//.test(id) ||
    /\/node_modules\/@wow-threat\/config\//.test(id)
  ) {
    return 'fight-config'
  }

  if (!id.includes('node_modules/')) {
    return undefined
  }

  if (/node_modules\/(echarts|echarts-for-react|zrender)\//.test(id)) {
    return 'vendor-echarts'
  }

  return 'vendor'
}

/**
 * Returns the esbuild options for the given build mode.
 * Exported for testing.
 */
export function getEsbuildOptions(
  mode: string,
): { pure: string[] } | undefined {
  if (mode !== 'production') return undefined
  // Mark purely informational console calls as side-effect-free so esbuild
  // can tree-shake them. console.warn and console.error are intentionally
  // excluded: warn is used for operational failure signals (IndexedDB errors,
  // worker fallbacks) and error is reserved for critical runtime failures —
  // both should survive in production builds.
  return { pure: ['console.log', 'console.info', 'console.debug'] }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: getEsbuildOptions(mode),
  build: {
    rollupOptions: {
      output: {
        manualChunks: getVendorChunkName,
      },
    },
  },
}))
