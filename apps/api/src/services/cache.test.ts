/**
 * Tests for Cache Service
 */
import type { Bindings } from '@/types/bindings'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockKV } from '../../test/setup'
import {
  CacheKeys,
  createCache,
  createKVCache,
  createMemoryCache,
  createNoOpCache,
} from './cache'

describe('createMemoryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stores and retrieves values', async () => {
    const cache = createMemoryCache()

    await cache.set('test-key', { foo: 'bar' })
    const result = await cache.get<{ foo: string }>('test-key')

    expect(result).toEqual({ foo: 'bar' })
  })

  it('returns null for missing keys', async () => {
    const cache = createMemoryCache()

    const result = await cache.get('non-existent')

    expect(result).toBeNull()
  })

  it('expires entries after TTL', async () => {
    const cache = createMemoryCache()

    // Set with 60 second TTL
    await cache.set('ttl-key', 'value', 60)

    // Should exist immediately
    expect(await cache.get('ttl-key')).toBe('value')

    // Advance time past TTL
    vi.advanceTimersByTime(61 * 1000)

    // Should be expired
    expect(await cache.get('ttl-key')).toBeNull()
  })

  it('persists entries without TTL indefinitely', async () => {
    const cache = createMemoryCache()

    await cache.set('permanent-key', 'value')

    // Advance time significantly
    vi.advanceTimersByTime(365 * 24 * 60 * 60 * 1000) // 1 year

    // Should still exist
    expect(await cache.get('permanent-key')).toBe('value')
  })

  it('deletes entries correctly', async () => {
    const cache = createMemoryCache()

    await cache.set('delete-key', 'value')
    expect(await cache.get('delete-key')).toBe('value')

    await cache.delete('delete-key')
    expect(await cache.get('delete-key')).toBeNull()
  })

  it('handles delete of non-existent key gracefully', async () => {
    const cache = createMemoryCache()

    // Should not throw
    await expect(cache.delete('non-existent')).resolves.not.toThrow()
  })
})

describe('createNoOpCache', () => {
  it('always returns null for get operations', async () => {
    const cache = createNoOpCache()

    // Set a value
    await cache.set('test-key', { foo: 'bar' })

    // Should still return null (no-op)
    const result = await cache.get('test-key')
    expect(result).toBeNull()
  })

  it('returns null for any key', async () => {
    const cache = createNoOpCache()

    expect(await cache.get('any-key')).toBeNull()
    expect(await cache.get('another-key')).toBeNull()
  })

  it('set operation does nothing', async () => {
    const cache = createNoOpCache()

    // Should not throw
    await expect(cache.set('key', 'value')).resolves.toBeUndefined()
    await expect(cache.set('key', 'value', 60)).resolves.toBeUndefined()

    // Should still return null
    expect(await cache.get('key')).toBeNull()
  })

  it('delete operation does nothing', async () => {
    const cache = createNoOpCache()

    // Should not throw
    await expect(cache.delete('any-key')).resolves.toBeUndefined()
  })
})

describe('createKVCache', () => {
  it('stores small values as plain JSON strings', async () => {
    const kv = createMockKV()
    const cache = createKVCache(kv)

    await cache.set('small-key', { ok: true })

    const putCalls = (kv.put as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(typeof putCalls[0]?.[1]).toBe('string')
  })

  it('compresses large values and reads them back transparently', async () => {
    const kv = createMockKV()
    const cache = createKVCache(kv)
    const value = { data: 'threat-event,'.repeat(40_000) }

    await cache.set('large-key', value)

    const putCalls = (kv.put as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(typeof putCalls[0]?.[1]).not.toBe('string')

    const result = await cache.get<typeof value>('large-key')
    expect(result).toEqual(value)
  })

  it('reads legacy uncompressed JSON values', async () => {
    const kv = createMockKV()
    const cache = createKVCache(kv)
    const value = { legacy: true }

    await kv.put('legacy-key', JSON.stringify(value))

    const result = await cache.get<typeof value>('legacy-key')
    expect(result).toEqual(value)
  })
})

describe('createCache', () => {
  it('returns memory cache for test environment', () => {
    const env = { ENVIRONMENT: 'test' } as Bindings
    const cache = createCache(env, 'augmented')

    expect(cache.type).toBe('memory')
  })

  it('returns kv cache for augmented data in development when binding is present', async () => {
    const env = {
      ENVIRONMENT: 'development',
      AUGMENTED_CACHE: createMockKV(),
    } as Bindings
    const cache = createCache(env, 'augmented')

    expect(cache.type).toBe('kv')

    await cache.set('test', 'value')
    expect(await cache.get('test')).toBe('value')
  })

  it('falls back to memory cache for augmented data in development without kv binding', async () => {
    const env = {
      ENVIRONMENT: 'development',
      AUGMENTED_CACHE: undefined,
    } as unknown as Bindings
    const cache = createCache(env, 'augmented')

    expect(cache.type).toBe('memory')

    await cache.set('test', 'value')
    expect(await cache.get('test')).toBe('value')
  })

  it('returns kv cache for wcl data in development when binding is present', async () => {
    const env = {
      ENVIRONMENT: 'development',
      WCL_CACHE: createMockKV(),
    } as Bindings
    const cache = createCache(env, 'wcl')

    expect(cache.type).toBe('kv')

    await cache.set('test', 'value')
    expect(await cache.get('test')).toBe('value')
  })

  it('falls back to memory cache for wcl data in development without kv binding', async () => {
    const env = {
      ENVIRONMENT: 'development',
      WCL_CACHE: undefined,
    } as unknown as Bindings
    const cache = createCache(env, 'wcl')

    expect(cache.type).toBe('memory')

    await cache.set('test', 'value')
    expect(await cache.get('test')).toBe('value')
  })
})

describe('CacheKeys', () => {
  it('generates correct wcl token key', () => {
    expect(CacheKeys.wclToken()).toBe('wcl:token')
  })

  it('generates correct report key', () => {
    expect(CacheKeys.report('ABC123', 'public')).toBe(
      'wcl:report:v6:ABC123:visibility:public:scope:shared:rankings:none',
    )
  })

  it('generates report key with ranking scope', () => {
    expect(CacheKeys.report('ABC123', 'private', 'uid-1', 'fights-32')).toBe(
      'wcl:report:v6:ABC123:visibility:private:scope:uid:uid-1:rankings:fights-32',
    )
  })

  it('generates correct fights key', () => {
    expect(CacheKeys.fights('ABC123', 5, 'private', 'uid-1')).toBe(
      'wcl:fights:v3:ABC123:5:visibility:private:scope:uid:uid-1',
    )
  })

  it('generates correct events key', () => {
    expect(CacheKeys.events('ABC123', 5, 'public')).toBe(
      'wcl:events:v3:ABC123:5:visibility:public:scope:shared:start:full:end:full',
    )
  })

  it('generates correct events key with explicit time bounds', () => {
    expect(CacheKeys.events('ABC123', 5, 'private', 'uid-1', 1000, 2000)).toBe(
      'wcl:events:v3:ABC123:5:visibility:private:scope:uid:uid-1:start:1000:end:2000',
    )
  })

  it('generates correct fight-scoped friendly buff bands key', () => {
    expect(CacheKeys.friendlyBuffBandsByFight('ABC123', 5, 'public')).toBe(
      'wcl:friendly-buff-bands-by-fight:v5:ABC123:5:visibility:public:scope:shared',
    )
  })

  it('generates correct encounter actor roles key', () => {
    expect(
      CacheKeys.encounterActorRoles('ABC123', 1602, 9, 'private', 'uid-1'),
    ).toBe(
      'wcl:encounter-actor-roles:v1:ABC123:1602:9:visibility:private:scope:uid:uid-1',
    )
  })

  it('generates correct augmented events key', () => {
    expect(
      CacheKeys.augmentedEvents(
        'ABC123',
        5,
        'v1.2.0',
        true,
        'private',
        'uid-1',
      ),
    ).toBe(
      'augmented:v14:ABC123:5:v1.2.0:inferThreatReduction:true:visibility:private:scope:uid:uid-1',
    )
  })

  it('does not collide public and private cache keys', () => {
    const publicEventsKey = CacheKeys.events('ABC123', 5, 'public')
    const privateEventsKey = CacheKeys.events('ABC123', 5, 'private', 'uid-1')

    expect(publicEventsKey).not.toBe(privateEventsKey)
  })

  it('does not collide private cache keys across users', () => {
    const firstUserKey = CacheKeys.events('ABC123', 5, 'private', 'uid-1')
    const secondUserKey = CacheKeys.events('ABC123', 5, 'private', 'uid-2')

    expect(firstUserKey).not.toBe(secondUserKey)
  })

  it('does not collide inferred and non-inferred augmented event keys', () => {
    const inferredKey = CacheKeys.augmentedEvents(
      'ABC123',
      5,
      'v1.2.0',
      true,
      'public',
    )
    const standardKey = CacheKeys.augmentedEvents(
      'ABC123',
      5,
      'v1.2.0',
      false,
      'public',
    )

    expect(inferredKey).not.toBe(standardKey)
  })

  it('treats invalid visibility values as private', () => {
    expect(CacheKeys.report('ABC123', 'internal')).toBe(
      'wcl:report:v6:ABC123:visibility:private:scope:uid:anonymous:rankings:none',
    )
  })
})
