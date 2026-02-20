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
            WCL_OAUTH_REDIRECT_URI: 'http://localhost:8787/auth/wcl/callback',
            FIREBASE_PROJECT_ID: 'wow-threat',
            FIREBASE_CLIENT_EMAIL:
              'firebase-adminsdk@test-project.iam.gserviceaccount.com',
            FIREBASE_PRIVATE_KEY:
              '-----BEGIN PRIVATE KEY-----\\nTEST_KEY\\n-----END PRIVATE KEY-----\\n',
            FIRESTORE_PROJECT_ID: 'wow-threat',
            WCL_TOKEN_ENCRYPTION_KEY: 'test-encryption-key',
            BRIDGE_CODE_SIGNING_SECRET: 'test-bridge-secret',
            ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:5174',
          },
        },
      },
    },
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
    },
  },
})
