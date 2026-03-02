/**
 * Integration tests for auth routes and bridge code behavior.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockBindings } from '../../test/setup'
import app from '../index'
import { AuthStore } from '../services/auth-store'
import { FirestoreClient } from '../services/firestore-client'

interface FirestoreDocument {
  fields: Record<string, unknown>
  updateTime: string
}

const firestorePrefix =
  'https://firestore.googleapis.com/v1/projects/wow-threat/databases/(default)/documents/'
const firestoreRunQueryPath =
  'https://firestore.googleapis.com/v1/projects/wow-threat/databases/(default)/documents:runQuery'

async function issueBridgeCode(bindings: ReturnType<typeof createMockBindings>) {
  const loginRes = await app.request(
    'http://localhost/auth/wcl/login?origin=http://localhost:5173',
    {},
    bindings,
  )
  const loginLocation = new URL(loginRes.headers.get('Location')!)
  const state = loginLocation.searchParams.get('state')
  expect(state).toBeTruthy()

  const callbackRes = await app.request(
    `http://localhost/auth/wcl/callback?code=oauth-code-123&state=${encodeURIComponent(state!)}`,
    {},
    bindings,
  )
  expect(callbackRes.status).toBe(302)

  const callbackLocation = new URL(callbackRes.headers.get('Location')!)
  const callbackHash = callbackLocation.hash.startsWith('#')
    ? callbackLocation.hash.slice(1)
    : callbackLocation.hash
  const bridgeCode = new URLSearchParams(callbackHash).get('bridge')
  expect(bridgeCode).toBeTruthy()

  return bridgeCode!
}

function createAuthFetchMock() {
  const documents = new Map<string, FirestoreDocument>()

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === 'string' ? input : input.toString()
    const url = new URL(requestUrl)

    if (url.toString().includes('warcraftlogs.com/oauth/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'wcl-access-token',
          expires_in: 3600,
          refresh_token: 'wcl-refresh-token',
          token_type: 'Bearer',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    if (url.toString().includes('warcraftlogs.com/oauth/revoke')) {
      return new Response(null, {
        status: 200,
      })
    }

    if (url.toString().includes('warcraftlogs.com/api/v2/user')) {
      return new Response(
        JSON.stringify({
          data: {
            userData: {
              currentUser: {
                id: 12345,
                name: 'TestWclUser',
              },
            },
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    if (url.toString().includes('warcraftlogs.com/api/v2/client')) {
      return new Response(
        JSON.stringify({
          data: {
            rateLimitData: {
              limitPerHour: 12000,
              pointsSpentThisHour: 4184.5,
              pointsResetIn: 1740,
            },
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    if (url.toString().startsWith(firestorePrefix)) {
      const relativePath = decodeURIComponent(
        url.toString().slice(firestorePrefix.length).split('?')[0] ?? '',
      )
      const searchParams = new URLSearchParams(url.search)
      const updateMask = searchParams.getAll('updateMask.fieldPaths')
      const currentUpdateTime = searchParams.get('currentDocument.updateTime')
      const document = documents.get(relativePath)
      const method = init?.method ?? 'GET'

      if (method === 'GET') {
        if (!document) {
          return new Response(
            JSON.stringify({
              error: {
                message: 'Document not found',
              },
            }),
            {
              status: 404,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
        }

        return new Response(
          JSON.stringify({
            fields: document.fields,
            updateTime: document.updateTime,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
      }

      if (method === 'DELETE') {
        if (!document) {
          return new Response(
            JSON.stringify({
              error: {
                message: 'Document not found',
              },
            }),
            {
              status: 404,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
        }

        documents.delete(relativePath)
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }

      if (method === 'PATCH') {
        if (
          currentUpdateTime &&
          (!document || document.updateTime !== currentUpdateTime)
        ) {
          return new Response(
            JSON.stringify({
              error: {
                message: 'Precondition failed',
              },
            }),
            {
              status: 412,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
        }

        const body = init?.body
          ? (JSON.parse(init.body as string) as {
              fields?: Record<string, unknown>
            })
          : { fields: {} }
        const nextFields: Record<string, unknown> = {
          ...(document?.fields ?? {}),
        }

        if (updateMask.length > 0) {
          updateMask.forEach((fieldPath) => {
            if (body.fields && fieldPath in body.fields) {
              nextFields[fieldPath] = body.fields[fieldPath]
            }
          })
        } else {
          Object.assign(nextFields, body.fields ?? {})
        }

        const updateTime = new Date(Date.now()).toISOString()
        documents.set(relativePath, {
          fields: nextFields,
          updateTime,
        })

        return new Response(
          JSON.stringify({
            fields: nextFields,
            updateTime,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
      }
    }

    if (url.toString() === firestoreRunQueryPath) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    throw new Error(`Unexpected fetch request in auth tests: ${requestUrl}`)
  })
}

describe('Auth Routes', () => {
  let fetchMock: ReturnType<typeof createAuthFetchMock>

  beforeEach(() => {
    fetchMock = createAuthFetchMock()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redirects to wcl oauth login with signed state', async () => {
    const res = await app.request(
      'http://localhost/auth/wcl/login?origin=http://localhost:5173',
      {},
      createMockBindings(),
    )

    expect(res.status).toBe(302)
    const location = res.headers.get('Location')
    expect(location).toBeTruthy()
    expect(location).toContain('https://www.warcraftlogs.com/oauth/authorize')
    expect(location).toContain('state=')
  })

  it('rejects callback requests with invalid oauth state', async () => {
    const res = await app.request(
      'http://localhost/auth/wcl/callback?code=abc123&state=invalid-state',
      {},
      createMockBindings(),
    )

    expect(res.status).toBe(401)
  })

  it('returns rate-limited response details when WCL user endpoint responds 429', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const requestUrl = typeof input === 'string' ? input : input.toString()

      if (requestUrl.includes('warcraftlogs.com/oauth/token')) {
        return new Response(
          JSON.stringify({
            access_token: 'wcl-access-token',
            expires_in: 3600,
            refresh_token: 'wcl-refresh-token',
            token_type: 'Bearer',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
      }

      if (requestUrl.includes('warcraftlogs.com/api/v2/user')) {
        return new Response('rate limited', {
          status: 429,
          headers: {
            'Retry-After': '15',
          },
        })
      }

      throw new Error(`Unexpected fetch request in auth tests: ${requestUrl}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const bindings = createMockBindings()
    const loginRes = await app.request(
      'http://localhost/auth/wcl/login?origin=http://localhost:5173',
      {},
      bindings,
    )
    const loginLocation = new URL(loginRes.headers.get('Location')!)
    const state = loginLocation.searchParams.get('state')

    expect(state).toBeTruthy()

    const callbackRes = await app.request(
      `http://localhost/auth/wcl/callback?code=oauth-code-123&state=${encodeURIComponent(state!)}`,
      {},
      bindings,
    )
    expect(callbackRes.status).toBe(429)
    expect(callbackRes.headers.get('Retry-After')).toBe('15')

    const callbackBody = (await callbackRes.json()) as {
      error: {
        code: string
        details?: Record<string, unknown>
      }
    }
    expect(callbackBody.error.code).toBe('WCL_RATE_LIMITED')
    expect(callbackBody.error.details).toEqual({
      context: 'wcl-user-profile',
      retryAfter: '15',
      retryAfterSeconds: 15,
    })

    const userCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('warcraftlogs.com/api/v2/user'),
    )
    expect(userCalls).toHaveLength(1)
  })

  it('returns current wcl api rate limit data for an authenticated user', async () => {
    const res = await app.request(
      'http://localhost/auth/wcl/rate-limit',
      {
        headers: {
          Authorization: 'Bearer test-firebase-id-token:wcl:12345',
        },
      },
      createMockBindings(),
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await res.json()).toEqual({
      limitPerHour: 12000,
      pointsSpentThisHour: 4184.5,
      pointsResetIn: 1740,
    })
  })

  it('rejects unauthenticated wcl rate limit requests', async () => {
    const res = await app.request(
      'http://localhost/auth/wcl/rate-limit',
      {},
      createMockBindings(),
    )

    expect(res.status).toBe(401)
  })

  it('exchanges bridge code once and rejects reuse', async () => {
    const bindings = createMockBindings()

    const loginRes = await app.request(
      'http://localhost/auth/wcl/login?origin=http://localhost:5173',
      {},
      bindings,
    )
    const loginLocation = new URL(loginRes.headers.get('Location')!)
    const state = loginLocation.searchParams.get('state')

    expect(state).toBeTruthy()

    const callbackRes = await app.request(
      `http://localhost/auth/wcl/callback?code=oauth-code-123&state=${encodeURIComponent(state!)}`,
      {},
      bindings,
    )
    expect(callbackRes.status).toBe(302)

    const callbackLocation = new URL(callbackRes.headers.get('Location')!)
    expect(callbackLocation.pathname).toBe('/auth/complete')
    const callbackHash = callbackLocation.hash.startsWith('#')
      ? callbackLocation.hash.slice(1)
      : callbackLocation.hash
    const bridgeCode = new URLSearchParams(callbackHash).get('bridge')
    expect(bridgeCode).toBeTruthy()

    const exchangeRes = await app.request(
      'http://localhost/auth/firebase-custom-token',
      {
        body: JSON.stringify({
          bridgeCode,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
      bindings,
    )
    expect(exchangeRes.status).toBe(200)

    const exchangeBody = (await exchangeRes.json()) as {
      customToken: string
    }
    expect(exchangeBody.customToken).toBe('test-custom-token:wcl:12345')

    const reuseRes = await app.request(
      'http://localhost/auth/firebase-custom-token',
      {
        body: JSON.stringify({
          bridgeCode,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
      bindings,
    )
    expect(reuseRes.status).toBe(401)
  })

  it('returns canonical wcl uid when exchanging bridge code from anonymous session', async () => {
    const bindings = createMockBindings()
    const authStore = new AuthStore(bindings)
    const bridgeCode = await issueBridgeCode(bindings)

    const exchangeRes = await app.request(
      'http://localhost/auth/firebase-custom-token',
      {
        body: JSON.stringify({
          bridgeCode,
        }),
        headers: {
          Authorization: 'Bearer test-firebase-id-token:anon-user:anonymous',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
      bindings,
    )
    expect(exchangeRes.status).toBe(200)

    const exchangeBody = (await exchangeRes.json()) as {
      customToken: string
      uid: string
    }
    expect(exchangeBody.customToken).toBe('test-custom-token:wcl:12345')
    expect(exchangeBody.uid).toBe('wcl:12345')

    const canonicalTokens = await authStore.getWclTokens('wcl:12345')
    expect(canonicalTokens).toMatchObject({
      uid: 'wcl:12345',
      wclUserId: '12345',
      wclUserName: 'TestWclUser',
    })
  })

  it('migrates anonymous settings to canonical uid when canonical settings do not exist', async () => {
    const bindings = createMockBindings()
    const firestore = new FirestoreClient(bindings)
    await firestore.patchDocument('settings', 'anon-user', {
      showBossMelee: { booleanValue: true },
    })

    const bridgeCode = await issueBridgeCode(bindings)

    const exchangeRes = await app.request(
      'http://localhost/auth/firebase-custom-token',
      {
        body: JSON.stringify({
          bridgeCode,
        }),
        headers: {
          Authorization: 'Bearer test-firebase-id-token:anon-user:anonymous',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
      bindings,
    )
    expect(exchangeRes.status).toBe(200)

    const canonicalSettings = await firestore.getDocument('settings', 'wcl:12345')
    expect(canonicalSettings?.fields?.showBossMelee).toEqual({
      booleanValue: true,
    })

    const sourceSettings = await firestore.getDocument('settings', 'anon-user')
    expect(sourceSettings).toBeNull()
  })

  it('does not overwrite canonical settings when exchanging from anonymous session', async () => {
    const bindings = createMockBindings()
    const firestore = new FirestoreClient(bindings)
    await firestore.patchDocument('settings', 'anon-user', {
      showBossMelee: { booleanValue: true },
    })
    await firestore.patchDocument('settings', 'wcl:12345', {
      showBossMelee: { booleanValue: false },
    })

    const bridgeCode = await issueBridgeCode(bindings)

    const exchangeRes = await app.request(
      'http://localhost/auth/firebase-custom-token',
      {
        body: JSON.stringify({
          bridgeCode,
        }),
        headers: {
          Authorization: 'Bearer test-firebase-id-token:anon-user:anonymous',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
      bindings,
    )
    expect(exchangeRes.status).toBe(200)

    const canonicalSettings = await firestore.getDocument('settings', 'wcl:12345')
    expect(canonicalSettings?.fields?.showBossMelee).toEqual({
      booleanValue: false,
    })

    const sourceSettings = await firestore.getDocument('settings', 'anon-user')
    expect(sourceSettings?.fields?.showBossMelee).toEqual({
      booleanValue: true,
    })
  })

  it('deletes stored WCL tokens during logout', async () => {
    const bindings = createMockBindings()
    const authStore = new AuthStore(bindings)
    await authStore.saveWclTokens({
      accessToken: 'wcl-access-token',
      accessTokenExpiresAtMs: Date.now() + 60_000,
      refreshToken: 'wcl-refresh-token',
      refreshTokenExpiresAtMs: null,
      tokenType: 'Bearer',
      uid: 'wcl',
      wclUserId: '12345',
      wclUserName: 'TestWclUser',
    })

    const logoutRes = await app.request(
      'http://localhost/auth/logout',
      {
        headers: {
          Authorization: 'Bearer test-firebase-id-token:wcl',
        },
        method: 'POST',
      },
      bindings,
    )
    expect(logoutRes.status).toBe(204)

    const deleteCalls = fetchMock.mock.calls.filter(([input, init]) => {
      return (
        String(input).includes('documents/wcl_auth_tokens/wcl') &&
        init?.method === 'DELETE'
      )
    })
    expect(deleteCalls).toHaveLength(1)

    const revokeCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('warcraftlogs.com/oauth/revoke'),
    )
    expect(revokeCalls).toHaveLength(0)
  })
})
