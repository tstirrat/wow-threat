/**
 * Playwright configuration for frontend E2E tests.
 */
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './src/pages',
  testMatch: '**/*.spec.ts',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm --filter @wcl-threat/web dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 120000,
  },
})
