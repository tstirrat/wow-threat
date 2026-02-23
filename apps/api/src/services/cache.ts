/**
 * Cache Service
 *
 * Abstraction over Cloudflare KV for caching.
 * Uses Cloudflare KV in production/staging and local wrangler dev (KV emulation).
 * Uses in-memory cache for tests and as a dev fallback when KV bindings are absent.
 */
import type { Bindings } from '../types/bindings'

export interface CacheService {
  readonly type: 'kv' | 'memory' | 'noop'
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
}

export type CacheVisibility = 'public' | 'private'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()
const gzipValuePrefix = new Uint8Array([0x57, 0x54, 0x4b, 0x56, 0x01]) // WTKV + v1
const compressionThresholdBytes = 256 * 1024

function isKVNamespace(value: unknown): value is KVNamespace {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<KVNamespace>
  return (
    typeof candidate.get === 'function' &&
    typeof candidate.put === 'function' &&
    typeof candidate.delete === 'function'
  )
}

/** Normalize report visibility; missing/invalid values are treated as private. */
export function normalizeVisibility(visibility: unknown): CacheVisibility {
  return visibility === 'public' ? 'public' : 'private'
}

function resolveVisibilityScope(visibility: unknown, uid?: string): string {
  if (normalizeVisibility(visibility) === 'public') {
    return 'shared'
  }

  return `uid:${uid?.trim() || 'anonymous'}`
}

function hasGzipPrefix(bytes: Uint8Array): boolean {
  return gzipValuePrefix.every((value, index) => bytes[index] === value)
}

function prependPrefix(bytes: Uint8Array): Uint8Array {
  const payload = new Uint8Array(gzipValuePrefix.length + bytes.length)
  payload.set(gzipValuePrefix, 0)
  payload.set(bytes, gzipValuePrefix.length)
  return payload
}

function stripPrefix(bytes: Uint8Array): Uint8Array {
  return bytes.subarray(gzipValuePrefix.length)
}

async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream('gzip')
  const writer = stream.writable.getWriter()
  await writer.write(Uint8Array.from(bytes))
  await writer.close()
  return new Uint8Array(await new Response(stream.readable).arrayBuffer())
}

async function gunzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('gzip')
  const writer = stream.writable.getWriter()
  await writer.write(Uint8Array.from(bytes))
  await writer.close()
  return new Uint8Array(await new Response(stream.readable).arrayBuffer())
}

async function serializeForKV(value: unknown): Promise<string | Uint8Array> {
  const json = JSON.stringify(value)
  const plainBytes = textEncoder.encode(json)
  if (plainBytes.length < compressionThresholdBytes) {
    return json
  }

  const gzippedBytes = await gzipBytes(plainBytes)
  if (gzippedBytes.length >= plainBytes.length) {
    return json
  }

  return prependPrefix(gzippedBytes)
}

async function deserializeFromKV<T>(value: ArrayBuffer): Promise<T> {
  const rawBytes = new Uint8Array(value)
  const payloadBytes = hasGzipPrefix(rawBytes)
    ? await gunzipBytes(stripPrefix(rawBytes))
    : rawBytes
  return JSON.parse(textDecoder.decode(payloadBytes)) as T
}

/**
 * Production cache using Cloudflare KV
 */
export function createKVCache(kv: KVNamespace): CacheService {
  return {
    type: 'kv',
    async get<T>(key: string): Promise<T | null> {
      const value = await kv.get(key, 'arrayBuffer')
      if (!value) {
        return null
      }
      return deserializeFromKV<T>(value)
    },

    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
      const options = ttl ? { expirationTtl: ttl } : undefined
      await kv.put(key, await serializeForKV(value), options)
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async get<T>(key: string): Promise<T | null> {
      return null
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
      // No-op
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async delete(key: string): Promise<void> {
      // No-op
    },
  }
}

// Singleton memory cache for tests and development fallback
let memoryCache: CacheService | null = null

/**
 * Factory to create appropriate cache based on environment
 */
export function createCache(
  env: Bindings,
  namespace: 'wcl' | 'augmented',
): CacheService {
  // Tests always use in-memory cache to keep fixtures self-contained.
  if (env.ENVIRONMENT === 'test') {
    if (!memoryCache) {
      memoryCache = createMemoryCache()
    }
    return memoryCache
  }

  if (env.ENVIRONMENT === 'development') {
    const kv = namespace === 'wcl' ? env.WCL_CACHE : env.AUGMENTED_CACHE
    if (isKVNamespace(kv)) {
      console.warn(
        `[Cache] Using KV cache for ${namespace} data in development`,
      )
      return createKVCache(kv)
    }

    // Fallback for local setups without KV binding.
    if (!memoryCache) {
      console.warn('[Cache] Initializing Memory cache')
      memoryCache = createMemoryCache()
    }
    console.warn(
      `[Cache] ${namespace.toUpperCase()}_CACHE binding missing; using Memory cache for ${namespace} data`,
    )
    return memoryCache
  }

  const kv = namespace === 'wcl' ? env.WCL_CACHE : env.AUGMENTED_CACHE
  return createKVCache(kv)
}

// Cache key builders
export const CacheKeys = {
  wclToken: () => 'wcl:token',
  reportSchemaVersion: 'v3',
  report: (code: string, visibility: unknown, uid?: string) =>
    `wcl:report:${CacheKeys.reportSchemaVersion}:${code}:visibility:${normalizeVisibility(visibility)}:scope:${resolveVisibilityScope(visibility, uid)}`,
  fightsSchemaVersion: 'v2',
  fights: (code: string, visibility: unknown, uid?: string) =>
    `wcl:fights:${CacheKeys.fightsSchemaVersion}:${code}:visibility:${normalizeVisibility(visibility)}:scope:${resolveVisibilityScope(visibility, uid)}`,
  wclEventsSchemaVersion: 'v3',
  events: (
    code: string,
    fightId: number,
    visibility: unknown,
    uid?: string,
    startTime?: number,
    endTime?: number,
  ) =>
    `wcl:events:${CacheKeys.wclEventsSchemaVersion}:${code}:${fightId}:visibility:${normalizeVisibility(visibility)}:scope:${resolveVisibilityScope(visibility, uid)}:start:${startTime ?? 'full'}:end:${endTime ?? 'full'}`,
  friendlyBuffBandsSchemaVersion: 'v4',
  friendlyBuffBandsByReport: (
    code: string,
    visibility: unknown,
    uid?: string,
  ) =>
    `wcl:friendly-buff-bands-by-report:${CacheKeys.friendlyBuffBandsSchemaVersion}:${code}:visibility:${normalizeVisibility(visibility)}:scope:${resolveVisibilityScope(visibility, uid)}`,
  augmentedSchemaVersion: 'v8',
  augmentedEvents: (
    code: string,
    fightId: number,
    configVersion: string,
    visibility: unknown,
    uid?: string,
  ) =>
    `augmented:${CacheKeys.augmentedSchemaVersion}:${code}:${fightId}:${configVersion}:visibility:${normalizeVisibility(visibility)}:scope:${resolveVisibilityScope(visibility, uid)}`,
}
