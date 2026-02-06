/**
 * Cache Service
 *
 * Abstraction over Cloudflare KV for caching.
 * Uses no-op cache for development (to allow immediate code changes).
 * Uses in-memory cache for test environments.
 */
import type { Bindings } from '../types/bindings'

export interface CacheService {
  readonly type: 'kv' | 'memory' | 'noop'
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
}

/**
 * Production cache using Cloudflare KV
 */
export function createKVCache(kv: KVNamespace): CacheService {
  return {
    type: 'kv',
    async get<T>(key: string): Promise<T | null> {
      const value = await kv.get(key, 'json')
      return value as T | null
    },

    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
      const options = ttl ? { expirationTtl: ttl } : undefined
      await kv.put(key, JSON.stringify(value), options)
    },

    async delete(key: string): Promise<void> {
      await kv.delete(key)
    },
  }
}

/**
 * Development/test cache using in-memory Map
 */
export function createMemoryCache(): CacheService {
  const store = new Map<string, { value: unknown; expires?: number }>()

  return {
    type: 'memory',
    async get<T>(key: string): Promise<T | null> {
      const entry = store.get(key)
      if (!entry) return null

      if (entry.expires && Date.now() > entry.expires) {
        store.delete(key)
        return null
      }

      return entry.value as T
    },

    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
      store.set(key, {
        value,
        expires: ttl ? Date.now() + ttl * 1000 : undefined,
      })
    },

    async delete(key: string): Promise<void> {
      store.delete(key)
    },
  }
}

/**
 * No-op cache for development - always returns null
 * This ensures code changes are immediately reflected without server restarts
 */
export function createNoOpCache(): CacheService {
  return {
    type: 'noop',
    async get<T>(key: string): Promise<T | null> {
      return null
    },

    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
      // No-op
    },

    async delete(key: string): Promise<void> {
      // No-op
    },
  }
}

// Singleton memory cache for tests
let memoryCache: CacheService | null = null

/**
 * Factory to create appropriate cache based on environment
 */
export function createCache(
  env: Bindings,
  namespace: 'wcl' | 'augmented',
): CacheService {
  // Use no-op cache for augmented data in development for immediate code change testing
  if (env.ENVIRONMENT === 'development' && namespace === 'augmented') {
    console.warn('[Cache] Using No-Op cache for augmented data')
    return createNoOpCache()
  }

  // Use memory cache for:
  // 1. Tests (all namespaces)
  // 2. Development (WCL data only - to avoid re-fetching static data)
  if (env.ENVIRONMENT === 'test' || env.ENVIRONMENT === 'development') {
    if (!memoryCache) {
      console.warn('[Cache] Initializing Memory cache')
      memoryCache = createMemoryCache()
    }
    if (env.ENVIRONMENT === 'development') {
      console.warn(`[Cache] Using Memory cache for ${namespace} data`)
    }
    return memoryCache
  }

  const kv = namespace === 'wcl' ? env.WCL_CACHE : env.AUGMENTED_CACHE
  return createKVCache(kv)
}

// Cache key builders
export const CacheKeys = {
  wclToken: () => 'wcl:token',
  report: (code: string) => `wcl:report:${code}`,
  fights: (code: string) => `wcl:fights:${code}`,
  events: (code: string, fightId: number) => `wcl:events:${code}:${fightId}`,
  augmentedEvents: (code: string, fightId: number, configVersion: string) =>
    `augmented:${code}:${fightId}:${configVersion}`,
}
