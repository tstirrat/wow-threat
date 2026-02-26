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

// https://vite.dev/config/
export default defineConfig({
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
      'react-hotkeys-hook': path.resolve(
        __dirname,
        './src/lib/react-hotkeys-hook.ts',
      ),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: getVendorChunkName,
      },
    },
  },
})
