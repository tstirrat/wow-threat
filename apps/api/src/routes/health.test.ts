/**
 * Integration tests for the health check route.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { restoreFetch } from '../../test/helpers/mock-fetch'
import { createMockBindings } from '../../test/setup'
import { app } from '../index'
import type { HealthCheckResponse } from '../types/bindings'

const firestoreHealthUrl =
  'https://firestore.googleapis.com/v1/projects/wow-threat/databases/(default)/documents/_health/ping'
const wclTokenUrl = 'https://www.warcraftlogs.com/oauth/token'

function makeFirestoreOkResponse(): Response {
  return new Response(null, { status: 404 })
}

function makeFirestoreErrorResponse(): Response {
  return new Response(JSON.stringify({ error: { message: 'unavailable' } }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeWclOkResponse(): Response {
  return new Response(
    JSON.stringify({
      access_token: 'tok',
      token_type: 'Bearer',
      expires_in: 3600,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

function makeWclErrorResponse(): Response {
  return new Response(JSON.stringify({ error: 'invalid_client' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubFetch(firestoreResponse: Response, wclResponse: Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === firestoreHealthUrl) return firestoreResponse
      if (url === wclTokenUrl) return wclResponse
      throw new Error(`Unexpected fetch: ${url}`)
    }),
  )
}

describe('GET /health', () => {
  afterEach(() => {
    restoreFetch()
  })

  describe('all dependencies healthy', () => {
    beforeEach(() => {
      stubFetch(makeFirestoreOkResponse(), makeWclOkResponse())
    })

    it('returns 200', async () => {
      const res = await app.request(
        'http://localhost/health',
        {},
        createMockBindings(),
      )
      expect(res.status).toBe(200)
    })

    it('returns status ok with all deps ok', async () => {
      const res = await app.request(
        'http://localhost/health',
        {},
        createMockBindings(),
      )
      const body: HealthCheckResponse = await res.json()

      expect(body.status).toBe('ok')
      expect(body.dependencies.kv.status).toBe('ok')
      expect(body.dependencies.firestore.status).toBe('ok')
      expect(body.dependencies.wcl.status).toBe('ok')
    })

    it('includes environment and requestId', async () => {
      const res = await app.request(
        'http://localhost/health',
        {},
        createMockBindings(),
      )
      const body: HealthCheckResponse = await res.json()

      expect(body.environment).toBe('test')
      expect(typeof body.requestId).toBe('string')
      expect(body.requestId.length).toBeGreaterThan(0)
    })

    it('includes latencyMs on each dependency', async () => {
      const res = await app.request(
        'http://localhost/health',
        {},
        createMockBindings(),
      )
      const body: HealthCheckResponse = await res.json()

      expect(typeof body.dependencies.kv.latencyMs).toBe('number')
      expect(typeof body.dependencies.firestore.latencyMs).toBe('number')
      expect(typeof body.dependencies.wcl.latencyMs).toBe('number')
    })
  })

  describe('one dependency down (firestore)', () => {
    beforeEach(() => {
      stubFetch(makeFirestoreErrorResponse(), makeWclOkResponse())
    })

    it('returns 200 for partial degradation', async () => {
      const res = await app.request(
        'http://localhost/health',
        {},
        createMockBindings(),
      )
      expect(res.status).toBe(200)
    })

    it('returns status degraded with firestore error', async () => {
      const res = await app.request(
        'http://localhost/health',
        {},
        createMockBindings(),
      )
      const body: HealthCheckResponse = await res.json()

      expect(body.status).toBe('degraded')
      expect(body.dependencies.kv.status).toBe('ok')
      expect(body.dependencies.firestore.status).toBe('error')
      expect(body.dependencies.wcl.status).toBe('ok')
    })
  })

  describe('all dependencies down', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
          const url = typeof input === 'string' ? input : input.toString()
          if (url === firestoreHealthUrl) return makeFirestoreErrorResponse()
          if (url === wclTokenUrl) return makeWclErrorResponse()
          throw new Error(`Unexpected fetch: ${url}`)
        }),
      )
    })

    it('returns 503', async () => {
      const bindings = createMockBindings()
      vi.spyOn(bindings.WCL_CACHE, 'put').mockRejectedValue(
        new Error('KV unavailable'),
      )
      const res = await app.request('http://localhost/health', {}, bindings)
      expect(res.status).toBe(503)
    })

    it('returns status error with all deps errored', async () => {
      const bindings = createMockBindings()
      vi.spyOn(bindings.WCL_CACHE, 'put').mockRejectedValue(
        new Error('KV unavailable'),
      )
      const res = await app.request('http://localhost/health', {}, bindings)
      const body: HealthCheckResponse = await res.json()

      expect(body.status).toBe('error')
      expect(body.dependencies.kv.status).toBe('error')
      expect(body.dependencies.firestore.status).toBe('error')
      expect(body.dependencies.wcl.status).toBe('error')
    })
  })

  describe('wcl dependency down', () => {
    beforeEach(() => {
      stubFetch(makeFirestoreOkResponse(), makeWclErrorResponse())
    })

    it('returns 200 for partial degradation', async () => {
      const res = await app.request(
        'http://localhost/health',
        {},
        createMockBindings(),
      )
      expect(res.status).toBe(200)
    })

    it('returns status degraded', async () => {
      const res = await app.request(
        'http://localhost/health',
        {},
        createMockBindings(),
      )
      const body: HealthCheckResponse = await res.json()

      expect(body.status).toBe('degraded')
      expect(body.dependencies.wcl.status).toBe('error')
    })
  })

  describe('cors', () => {
    beforeEach(() => {
      stubFetch(makeFirestoreOkResponse(), makeWclOkResponse())
    })

    it('allows localhost web origin for local development', async () => {
      const res = await app.request(
        'http://localhost/health',
        {
          headers: {
            Origin: 'http://localhost:5174',
          },
        },
        createMockBindings(),
      )

      expect(res.status).toBe(200)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
        'http://localhost:5174',
      )
    })
  })
})
