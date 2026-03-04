/**
 * Playwright configuration for frontend E2E tests.
 */
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './src/pages',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results',
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:9090',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm --filter @wow-threat/web dev --port 9090',
    env: {
      ...process.env,
      VITE_DISABLE_AUTH: 'true',
    },
    port: 9090,
    reuseExistingServer: true,
    timeout: 120000,
  },
})
