import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    silent: true,
    globals: true,
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    poolOptions: {
      workers: {
        singleWorker: true,
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          kvNamespaces: ['WCL_CACHE', 'AUGMENTED_CACHE'],
          bindings: {
            ENVIRONMENT: 'test',
            WCL_CLIENT_ID: 'test-client',
            WCL_CLIENT_SECRET: 'test-secret',
            API_KEY_SALT: 'test-salt',
          },
        },
      },
    },
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/types/**'],
    },
  },
})
