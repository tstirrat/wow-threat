/**
 * Unit tests for health check service functions.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createMockBindings } from '../../test/setup'
import {
  checkFirestore,
  checkKV,
  checkWCL,
  runHealthChecks,
} from './health-check'

const firestoreHealthUrl =
  'https://firestore.googleapis.com/v1/projects/wow-threat/databases/(default)/documents/_health/ping'
const wclTokenUrl = 'https://www.warcraftlogs.com/oauth/token'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// =============================================================================
// checkKV
// =============================================================================

describe('checkKV', () => {
  it('returns ok when put and get succeed', async () => {
    const env = createMockBindings()
    const result = await checkKV(env)

    expect(result.status).toBe('ok')
    expect(typeof result.latencyMs).toBe('number')
    expect(result.message).toBeUndefined()
  })

  it('returns error when put throws', async () => {
    const env = createMockBindings()
    vi.spyOn(env.WCL_CACHE, 'put').mockRejectedValue(
      new Error('KV write failed'),
    )

    const result = await checkKV(env)

    expect(result.status).toBe('error')
    expect(result.message).toBe('KV write failed')
  })

  it('returns error when get returns wrong value', async () => {
    const env = createMockBindings()
    vi.spyOn(env.WCL_CACHE, 'get').mockResolvedValue('wrong' as never)

    const result = await checkKV(env)

    expect(result.status).toBe('error')
    expect(result.message).toContain('mismatch')
  })
})

// =============================================================================
// checkFirestore
// =============================================================================

describe('checkFirestore', () => {
  it('returns ok when firestore responds with 404 (document not found)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 })),
    )
    const env = createMockBindings()
    const result = await checkFirestore(env)

    expect(result.status).toBe('ok')
    expect(typeof result.latencyMs).toBe('number')
  })

  it('returns ok when firestore responds with 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ fields: {} }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
    const env = createMockBindings()
    const result = await checkFirestore(env)

    expect(result.status).toBe('ok')
  })

  it('returns error when firestore is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === firestoreHealthUrl) {
          return new Response(
            JSON.stringify({ error: { message: 'unavailable' } }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )
    const env = createMockBindings()
    const result = await checkFirestore(env)

    expect(result.status).toBe('error')
    expect(result.message).toBeTruthy()
  })

  it('returns error when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network error')
      }),
    )
    const env = createMockBindings()
    const result = await checkFirestore(env)

    expect(result.status).toBe('error')
    expect(result.message).toBe('network error')
  })
})

// =============================================================================
// checkWCL
// =============================================================================

describe('checkWCL', () => {
  it('returns ok when token endpoint responds with 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              access_token: 'tok',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    )
    const env = createMockBindings()
    const result = await checkWCL(env)

    expect(result.status).toBe('ok')
    expect(typeof result.latencyMs).toBe('number')
  })

  it('returns error when token endpoint returns 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'invalid_client' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
    const env = createMockBindings()
    const result = await checkWCL(env)

    expect(result.status).toBe('error')
    expect(result.message).toContain('401')
  })

  it('returns error when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connection refused')
      }),
    )
    const env = createMockBindings()
    const result = await checkWCL(env)

    expect(result.status).toBe('error')
    expect(result.message).toBe('connection refused')
  })

  it('hits the WCL token URL', async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === wclTokenUrl) {
        return new Response(
          JSON.stringify({
            access_token: 'tok',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', mockFetch)
    const env = createMockBindings()

    await checkWCL(env)

    expect(mockFetch).toHaveBeenCalledWith(
      wclTokenUrl,
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

// =============================================================================
// runHealthChecks
// =============================================================================

describe('runHealthChecks', () => {
  it('returns ok when all checks pass', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === firestoreHealthUrl)
          return new Response(null, { status: 404 })
        if (url === wclTokenUrl) {
          return new Response(
            JSON.stringify({
              access_token: 'tok',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )
    const env = createMockBindings()
    const result = await runHealthChecks(env)

    expect(result.status).toBe('ok')
    expect(result.dependencies.kv.status).toBe('ok')
    expect(result.dependencies.firestore.status).toBe('ok')
    expect(result.dependencies.wcl.status).toBe('ok')
  })

  it('returns degraded when one check fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === firestoreHealthUrl) {
          return new Response(JSON.stringify({ error: { message: 'down' } }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (url === wclTokenUrl) {
          return new Response(
            JSON.stringify({
              access_token: 'tok',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )
    const env = createMockBindings()
    const result = await runHealthChecks(env)

    expect(result.status).toBe('degraded')
    expect(result.dependencies.kv.status).toBe('ok')
    expect(result.dependencies.firestore.status).toBe('error')
    expect(result.dependencies.wcl.status).toBe('ok')
  })

  it('returns error when all checks fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    const env = createMockBindings()
    vi.spyOn(env.WCL_CACHE, 'put').mockRejectedValue(new Error('KV down'))

    const result = await runHealthChecks(env)

    expect(result.status).toBe('error')
    expect(result.dependencies.kv.status).toBe('error')
    expect(result.dependencies.firestore.status).toBe('error')
    expect(result.dependencies.wcl.status).toBe('error')
  })
})
