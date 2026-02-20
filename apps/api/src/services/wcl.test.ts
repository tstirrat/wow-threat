/**
 * Tests for WCL client user-token fallback and visibility-aware behavior.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockBindings } from '../../test/setup'
import { encryptSecret, importAesGcmKey } from './token-utils'
import { WCLClient } from './wcl'

const firestorePrefix =
  'https://firestore.googleapis.com/v1/projects/wow-threat/databases/(default)/documents/'

function createWclReport(overrides: Record<string, unknown> = {}) {
  return {
    reportData: {
      report: {
        code: 'ABC123',
        title: 'Test Report',
        visibility: 'public',
        owner: { name: 'Owner' },
        startTime: 1000,
        endTime: 2000,
        fights: [],
        masterData: {
          gameVersion: 4,
          actors: [],
          abilities: [],
        },
        zone: { id: 1, name: 'Zone' },
        ...overrides,
      },
    },
  }
}

async function createEncryptedTokenDocument() {
  const key = await importAesGcmKey('test-encryption-key')
  const encryptedAccessToken = await encryptSecret('user-access-token', key)

  return {
    fields: {
      accessToken: { stringValue: encryptedAccessToken },
      accessTokenExpiresAtMs: {
        integerValue: String(Date.now() + 3_600_000),
      },
      refreshToken: { nullValue: null },
      refreshTokenExpiresAtMs: { nullValue: null },
      tokenType: { stringValue: 'Bearer' },
      uid: { stringValue: 'wcl:12345' },
      wclUserId: { stringValue: '12345' },
      wclUserName: { stringValue: 'TestUser' },
    },
    updateTime: new Date().toISOString(),
  }
}

function createWclFetchMock(options: {
  clientTokenFails?: boolean
  privateReport?: boolean
}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()

    // WCL client credentials token
    if (
      url.includes('warcraftlogs.com/oauth/token') &&
      init?.body?.toString().includes('client_credentials')
    ) {
      return new Response(
        JSON.stringify({
          access_token: 'client-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // WCL GraphQL API
    if (url.includes('warcraftlogs.com/api/v2/client')) {
      const authHeader =
        init?.headers instanceof Headers
          ? init.headers.get('Authorization')
          : (init?.headers as Record<string, string>)?.Authorization
      const isUserToken = authHeader === 'Bearer user-access-token'

      if (options.clientTokenFails && !isUserToken) {
        return new Response(
          JSON.stringify({
            errors: [{ message: 'You do not have permission' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      const visibility = options.privateReport ? 'private' : 'public'
      return new Response(
        JSON.stringify({
          data: createWclReport({ visibility }),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Firestore — return token documents for user token fallback
    if (url.startsWith(firestorePrefix)) {
      const method = init?.method ?? 'GET'

      if (method === 'GET') {
        return new Response(
          JSON.stringify(await createEncryptedTokenDocument()),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      if (method === 'PATCH') {
        return new Response(
          JSON.stringify({ fields: {}, updateTime: new Date().toISOString() }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    // KV cache — miss
    return new Response(null, { status: 404 })
  })
}

describe('WCLClient.getReport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns report data on successful client-token query', async () => {
    vi.stubGlobal('fetch', createWclFetchMock({ clientTokenFails: false }))
    const bindings = createMockBindings()
    const client = new WCLClient(bindings, 'wcl:12345')

    const result = await client.getReport('ABC123')

    expect(result.reportData.report.code).toBe('ABC123')
    expect(result.reportData.report.visibility).toBe('public')
  })

  it('falls back to user token when client token gets permission error', async () => {
    const mockFetch = createWclFetchMock({ clientTokenFails: true })
    vi.stubGlobal('fetch', mockFetch)
    const bindings = createMockBindings()
    const client = new WCLClient(bindings, 'wcl:12345')

    const result = await client.getReport('PRIVATE1')

    expect(result.reportData.report).toBeTruthy()

    // Verify the Firestore token lookup was called
    const firestoreCalls = mockFetch.mock.calls.filter((call) => {
      const callUrl = typeof call[0] === 'string' ? call[0] : call[0].toString()
      return callUrl.startsWith(firestorePrefix)
    })
    expect(firestoreCalls.length).toBeGreaterThan(0)
  })
})

describe('WCLClient.getEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('uses client token for public visibility', async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.includes('warcraftlogs.com/oauth/token')) {
        return new Response(
          JSON.stringify({
            access_token: 'client-token',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (url.includes('warcraftlogs.com/api/v2/client')) {
        return new Response(
          JSON.stringify({
            data: {
              reportData: {
                report: {
                  events: {
                    data: [{ type: 'damage', timestamp: 100 }],
                    nextPageTimestamp: null,
                  },
                },
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      return new Response(null, { status: 404 })
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = new WCLClient(createMockBindings(), 'wcl:12345')
    const events = await client.getEvents('ABC123', 1, 'public', 0, 1000)

    expect(events).toHaveLength(1)

    // Verify no Firestore calls were made (no user token needed for public)
    const firestoreCalls = mockFetch.mock.calls.filter((call) => {
      const callUrl = typeof call[0] === 'string' ? call[0] : call[0].toString()
      return callUrl.startsWith(firestorePrefix)
    })
    expect(firestoreCalls).toHaveLength(0)
  })
})
