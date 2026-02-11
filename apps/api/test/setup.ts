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
    API_KEY_SALT: 'test-salt',
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
