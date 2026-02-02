import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    poolOptions: {
      workers: {
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
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/types/**'],
    },
  },
})
