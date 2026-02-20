/**
 * Test Setup
 *
 * Common test utilities and mock factories.
 */
import { vi } from 'vitest'

/**
 * Create a mock KV namespace for testing
 */
export function createMockKV(): KVNamespace {
  const store = new Map<string, string>()

  return {
    get: vi.fn(async (key: string, typeOrOptions?: unknown) => {
      const val = store.get(key)
      if (!val) return null

      // Handle type parameter
      if (typeof typeOrOptions === 'string' && typeOrOptions === 'json') {
        return JSON.parse(val)
      }
      if (typeof typeOrOptions === 'object' && typeOrOptions !== null) {
        const opts = typeOrOptions as { type?: string }
        if (opts.type === 'json') {
          return JSON.parse(val)
        }
      }
      return val
    }),

    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),

    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),

    list: vi.fn(async () => ({
      keys: [...store.keys()].map((name) => ({ name })),
      list_complete: true,
      cacheStatus: null,
    })),

    getWithMetadata: vi.fn(async (key: string) => ({
      value: store.get(key) ?? null,
      metadata: null,
      cacheStatus: null,
    })),
  } as unknown as KVNamespace
}

/**
 * Create mock Bindings for testing
 */
export function createMockBindings() {
  return {
    ENVIRONMENT: 'test' as const,
    WCL_CLIENT_ID: 'test-client',
    WCL_CLIENT_SECRET: 'test-secret',
    WCL_OAUTH_REDIRECT_URI: 'http://localhost:8787/auth/wcl/callback',
    FIREBASE_PROJECT_ID: 'wow-threat',
    FIREBASE_CLIENT_EMAIL:
      'firebase-adminsdk@test-project.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY:
      '-----BEGIN PRIVATE KEY-----\\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC2j9zJ0r9Vs88R\\nLx4E6YJQ4a6YfX6o5N0Z1n6kB4qgS0oD4ZJ2KlcVh5jQ5fdA3g2MJjM0xEX8E3A0\\n9g4Qe8k4Rzv9x4N6mQ8x9Gd4i1f7vRz4bUu2Y0a5fQk6iQ9gG4fG0iV8T2xWn7G3\\nJv1YVYv2QZ3nFq7zR0nY3u8dFz5o8m5aRjR7Vt8YvP0Y6Bq9D2h1j3m4P7m8xQ9P\\nq3m2g2F8W6W1Q9K9R7fA3bD9kL2m2J8j3a6x4d1W5M6c7D8R9v0u1w2x3y4z5A6B\\n7C8D9E0F1G2H3I4J5K6L7M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z\\n-----END PRIVATE KEY-----\\n',
    FIRESTORE_PROJECT_ID: 'wow-threat',
    WCL_TOKEN_ENCRYPTION_KEY: 'test-encryption-key',
    BRIDGE_CODE_SIGNING_SECRET: 'test-bridge-secret',
    ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:5174',
    WCL_CACHE: createMockKV(),
    AUGMENTED_CACHE: createMockKV(),
  }
}

/**
 * Create a mock fetch response
 */
export function createMockResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
