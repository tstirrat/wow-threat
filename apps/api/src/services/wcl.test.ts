/**
 * Tests for WCL client user-token fallback and visibility-aware behavior.
 */
import type { Report } from '@wow-threat/wcl-types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockBindings } from '../../test/setup'
import { type AppError, ErrorCodes } from '../middleware/error'
import { encryptSecret, importAesGcmKey } from './token-utils'
import { WCLClient, resolveFightTankActorIds } from './wcl'

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
    if (url.includes('warcraftlogs.com/api/v2/')) {
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

  it('keeps default report metadata query free of rankings payloads', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()

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

        if (url.includes('warcraftlogs.com/api/v2/client')) {
          const body = init?.body ? JSON.parse(init.body.toString()) : {}
          const query = body.query as string

          expect(query).not.toContain('rankedCharacters')
          expect(query).not.toContain('encounterRankings')
          expect(query).not.toContain('rankings(')

          return new Response(
            JSON.stringify({
              data: createWclReport({ visibility: 'public' }),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(null, { status: 404 })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = new WCLClient(createMockBindings(), 'wcl:12345')
    await client.getReport('ABC123')
  })

  it('falls back to user token when client token gets permission error', async () => {
    const mockFetch = createWclFetchMock({ clientTokenFails: true })
    vi.stubGlobal('fetch', mockFetch)
    const bindings = createMockBindings()
    const client = new WCLClient(bindings, 'wcl:12345')

    const result = await client.getReport('PRIVATE1')

    expect(result.reportData.report).toBeTruthy()

    const userApiCalls = mockFetch.mock.calls.filter((call) => {
      const callUrl = typeof call[0] === 'string' ? call[0] : call[0].toString()
      return callUrl.includes('warcraftlogs.com/api/v2/user')
    })
    expect(userApiCalls).toHaveLength(1)

    // Verify the Firestore token lookup was called
    const firestoreCalls = mockFetch.mock.calls.filter((call) => {
      const callUrl = typeof call[0] === 'string' ? call[0] : call[0].toString()
      return callUrl.startsWith(firestorePrefix)
    })
    expect(firestoreCalls.length).toBeGreaterThan(0)
  })

  it('surfaces retry-after details when graphql is rate limited', async () => {
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
        return new Response('rate limited', {
          status: 429,
          headers: {
            'Retry-After': '27',
          },
        })
      }

      return new Response(null, { status: 404 })
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = new WCLClient(createMockBindings(), 'wcl:12345')

    await expect(client.getReport('RATE429')).rejects.toMatchObject({
      code: ErrorCodes.WCL_RATE_LIMITED,
      details: {
        context: 'wcl-client-graphql',
        retryAfter: '27',
        retryAfterSeconds: 27,
      },
      statusCode: 429,
    } satisfies Partial<AppError>)
  })
})

describe('WCLClient.getFightDetails', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('requests fight-scoped report metadata with fight-scoped player details', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
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
          const body = init?.body ? JSON.parse(init.body.toString()) : {}
          const query = body.query as string

          expect(query).toContain('query GetFightDetails')
          expect(query).toContain('fights(fightIDs: $fightIDs)')
          expect(query).toContain(
            'playerDetails(fightIDs: $fightIDs, includeCombatantInfo: false)',
          )
          expect(body.variables.fightIDs).toEqual([32])

          return new Response(
            JSON.stringify({
              data: createWclReport({
                fights: [
                  {
                    id: 32,
                    encounterID: 1234,
                    name: 'Fight 32',
                    startTime: 1,
                    endTime: 2,
                    kill: true,
                    difficulty: null,
                    bossPercentage: null,
                    fightPercentage: null,
                    enemyNPCs: [],
                    enemyPets: [],
                    friendlyPlayers: [],
                    friendlyPets: [],
                  },
                ],
                playerDetails: {
                  data: {
                    playerDetails: {
                      tanks: [],
                      healers: [],
                      dps: [],
                    },
                  },
                },
              }),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(null, { status: 404 })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = new WCLClient(createMockBindings(), 'wcl:12345')
    const result = await client.getFightDetails('ABC123', 32)

    expect(result.reportData?.report?.fights?.[0]?.id).toBe(32)
  })
})

describe('resolveFightTankActorIds', () => {
  it('returns tank actor ids when player details include tank bucket entries', () => {
    const report = {
      code: 'ABC123',
      title: 'Tank roles',
      owner: { name: 'Owner' },
      visibility: 'public',
      guild: null,
      startTime: 1000,
      endTime: 5000,
      zone: { id: 1, name: 'Zone' },
      fights: [
        {
          id: 11,
          encounterID: 9001,
          name: 'Boss',
          startTime: 1000,
          endTime: 5000,
          kill: true,
          difficulty: null,
          bossPercentage: null,
          fightPercentage: null,
          enemyNPCs: [],
          enemyPets: [],
          friendlyPlayers: [1, 2, 3],
          friendlyPets: [],
        },
      ],
      masterData: {
        gameVersion: 2,
        actors: [
          {
            id: 1,
            name: 'Tank',
            type: 'Player' as const,
            subType: 'Warrior' as const,
            petOwner: null,
          },
          {
            id: 2,
            name: 'Dps',
            type: 'Player' as const,
            subType: 'Rogue' as const,
            petOwner: null,
          },
          {
            id: 3,
            name: 'Healer',
            type: 'Player' as const,
            subType: 'Priest' as const,
            petOwner: null,
          },
        ],
      },
      playerDetails: {
        data: {
          playerDetails: {
            tanks: [
              {
                id: 1,
                name: 'Tank',
                type: 'Warrior',
                specs: [{ count: 1, spec: 'Protection' }],
              },
            ],
            healers: [
              {
                id: 3,
                name: 'Healer',
                type: 'Priest',
                specs: [{ count: 1, spec: 'Discipline' }],
              },
            ],
            dps: [
              {
                id: 2,
                name: 'Dps',
                type: 'Rogue',
                specs: [{ count: 1, spec: 'Combat' }],
              },
            ],
          },
        },
      },
    }

    expect(resolveFightTankActorIds(report as unknown as Report, 11)).toEqual(
      new Set([1]),
    )
  })

  it('returns an empty set when fight or player details are missing', () => {
    const report = {
      code: 'ABC123',
      title: 'No player details',
      owner: { name: 'Owner' },
      visibility: 'public',
      guild: null,
      startTime: 1000,
      endTime: 5000,
      zone: { id: 1, name: 'Zone' },
      fights: [
        {
          id: 12,
          encounterID: 9002,
          name: 'Boss',
          startTime: 1000,
          endTime: 5000,
          kill: true,
          difficulty: null,
          bossPercentage: null,
          fightPercentage: null,
          enemyNPCs: [],
          enemyPets: [],
          friendlyPlayers: [1],
          friendlyPets: [],
        },
      ],
      masterData: {
        gameVersion: 2,
        actors: [],
      },
    }

    expect(resolveFightTankActorIds(report as unknown as Report, 999)).toEqual(
      new Set(),
    )
    expect(resolveFightTankActorIds(report as unknown as Report, 12)).toEqual(
      new Set(),
    )
  })
})

describe('WCLClient.getFightPlayerRoles', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns mapped friendly actor roles from fight player details', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
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
          const body = init?.body ? JSON.parse(init.body.toString()) : {}
          const query = body.query as string

          if (query.includes('GetFightPlayerDetails')) {
            return new Response(
              JSON.stringify({
                data: {
                  reportData: {
                    report: {
                      playerDetails: {
                        data: {
                          playerDetails: {
                            tanks: [
                              {
                                id: 102355392,
                                name: 'Merryday',
                                type: 'Warrior',
                                specs: [{ count: 1, spec: 'Protection' }],
                              },
                            ],
                            healers: [
                              {
                                id: 105947179,
                                name: 'Musictwo',
                                type: 'Priest',
                                specs: [{ count: 1, spec: 'Discipline' }],
                              },
                            ],
                            dps: [
                              {
                                id: 91613399,
                                name: 'Benderheide',
                                type: 'Rogue',
                                specs: [{ count: 1, spec: 'Combat' }],
                              },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }
        }

        return new Response(null, { status: 404 })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = new WCLClient(createMockBindings(), 'wcl:12345')
    const actorRoles = await client.getFightPlayerRoles(
      'ABC123',
      9,
      'public',
      [
        { id: 102355392, name: 'Merryday' },
        { id: 105947179, name: 'Musictwo' },
        { id: 91613399, name: 'Benderheide' },
      ],
    )

    expect(actorRoles).toEqual(
      new Map<number, 'Tank' | 'Healer' | 'DPS'>([
        [102355392, 'Tank'],
        [105947179, 'Healer'],
        [91613399, 'DPS'],
      ]),
    )
  })
})

describe('WCLClient.getRateLimitData', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns rate limit data from the client graphql endpoint', async () => {
    const mockFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
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
          const body = init?.body ? JSON.parse(init.body.toString()) : {}
          expect(body.query as string).toContain('rateLimitData')
          return new Response(
            JSON.stringify({
              data: {
                rateLimitData: {
                  limitPerHour: 12000,
                  pointsSpentThisHour: 2375.5,
                  pointsResetIn: 901,
                },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(null, { status: 404 })
      },
    )
    vi.stubGlobal('fetch', mockFetch)

    const client = new WCLClient(createMockBindings(), 'wcl:12345')
    const result = await client.getRateLimitData()

    expect(result).toEqual({
      limitPerHour: 12000,
      pointsSpentThisHour: 2375.5,
      pointsResetIn: 901,
    })
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

describe('WCLClient.getFriendlyBuffAurasAtFightStart', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('extracts active fight-start aura IDs from actor-scoped batch query', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
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
          const body = init?.body ? JSON.parse(init.body.toString()) : {}
          const query = body.query as string

          if (query.includes('GetFriendlyBuffBandsByActor')) {
            return new Response(
              JSON.stringify({
                data: {
                  reportData: {
                    report: {
                      friendly_1: {
                        data: {
                          auras: [
                            {
                              bands: [{ startTime: 500, endTime: 1800 }],
                              guid: 1038,
                            },
                            {
                              bands: [{ startTime: 1800, endTime: 2800 }],
                              guid: 25895,
                            },
                          ],
                        },
                      },
                      friendly_2: {
                        data: {
                          auras: [
                            {
                              bands: [{ startTime: 0, endTime: 900 }],
                              guid: 1038,
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            )
          }
        }

        return new Response(null, { status: 404 })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = new WCLClient(createMockBindings(), 'wcl:12345')
    const result = await client.getFriendlyBuffAurasAtFightStart(
      'BUFFMAP1',
      3,
      'public',
      1000,
      new Set([1, 2]),
      {
        queryFightIds: [3, 4],
        queryFriendlyActorIds: new Set([1, 2]),
      },
    )

    expect(result.get(1)).toEqual([1038])
    expect(result.has(2)).toBe(false)

    const actorBatchCall = fetchMock.mock.calls.find((call) => {
      const body = call[1]?.body
      if (!body) {
        return false
      }

      const query = JSON.parse(body.toString()).query as string
      return query.includes('GetFriendlyBuffBandsByActor')
    })
    expect(actorBatchCall).toBeDefined()
    const actorBatchBody = JSON.parse(actorBatchCall![1]!.body!.toString()) as {
      query: string
      variables: {
        fightIDs: number[]
      }
    }
    expect(actorBatchBody.query).toContain('targetID: 1')
    expect(actorBatchBody.query).toContain('targetID: 2')
    expect(actorBatchBody.query).toContain('viewBy: Target')
    expect(actorBatchBody.query).not.toContain('sourceID:')
    const actorBatchVariables = actorBatchBody.variables as {
      fightIDs: number[]
    }
    expect(actorBatchVariables.fightIDs).toEqual([3, 4])
  })

  it('uses fight-scoped band cache and does not reuse across different fights', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
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
          const body = init?.body ? JSON.parse(init.body.toString()) : {}
          const query = body.query as string

          if (query.includes('GetFriendlyBuffBandsByActor')) {
            return new Response(
              JSON.stringify({
                data: {
                  reportData: {
                    report: {
                      friendly_1: {
                        data: {
                          auras: [
                            {
                              bands: [{ startTime: 100, endTime: 2000 }],
                              guid: 1038,
                            },
                            {
                              bands: [{ startTime: 2050, endTime: 4000 }],
                              guid: 25895,
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            )
          }
        }

        return new Response(null, { status: 404 })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = new WCLClient(createMockBindings(), 'wcl:12345')
    const friendlyIds = new Set([1])
    const queryOptions = {
      queryFightIds: [3, 4],
      queryFriendlyActorIds: new Set([1]),
    }

    const first = await client.getFriendlyBuffAurasAtFightStart(
      'BUFFCACHE1',
      3,
      'public',
      1000,
      friendlyIds,
      queryOptions,
    )
    const second = await client.getFriendlyBuffAurasAtFightStart(
      'BUFFCACHE1',
      4,
      'public',
      2500,
      friendlyIds,
      queryOptions,
    )

    expect(first.get(1)).toEqual([1038])
    expect(second.get(1)).toEqual([25895])

    const tableCalls = fetchMock.mock.calls.filter((call) => {
      const body = call[1]?.body
      if (!body) {
        return false
      }

      const query = JSON.parse(body.toString()).query as string
      return query.includes('GetFriendlyBuffBandsByActor')
    })
    expect(tableCalls).toHaveLength(2)
  })
})
describe('WCLClient.getRecentReports', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns merged personal and guild reports sorted by newest', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()

        if (url.startsWith(firestorePrefix)) {
          return new Response(
            JSON.stringify(await createEncryptedTokenDocument()),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (url.includes('warcraftlogs.com/api/v2/user')) {
          const body = init?.body ? JSON.parse(init.body.toString()) : {}
          const query = body.query as string

          if (query.includes('CurrentUserProfile')) {
            return new Response(
              JSON.stringify({
                data: {
                  userData: {
                    currentUser: {
                      id: 12345,
                      guilds: [{ id: 77 }],
                    },
                  },
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            )
          }

          if (query.includes('RecentReports')) {
            const variables = body.variables as Record<string, unknown>
            if (variables.userID === 12345) {
              return new Response(
                JSON.stringify({
                  data: {
                    reportData: {
                      reports: {
                        data: [
                          {
                            code: 'PERSONAL1',
                            title: 'Personal #1',
                            startTime: 2000,
                            endTime: 2100,
                            zone: { name: 'Naxxramas' },
                            guild: {
                              name: 'Threat Guild',
                              faction: { name: 'Alliance' },
                            },
                            archiveStatus: {
                              isArchived: false,
                              isAccessible: true,
                              archiveDate: null,
                            },
                          },
                          {
                            code: 'DUPLICATE',
                            title: 'Shared',
                            startTime: 1800,
                            endTime: 1900,
                            zone: { name: 'Karazhan' },
                            guild: {
                              name: 'Threat Guild',
                              faction: { name: 'Alliance' },
                            },
                            archiveStatus: {
                              isArchived: false,
                              isAccessible: true,
                              archiveDate: null,
                            },
                          },
                          {
                            code: 'ARCHIVED-PRIVATE',
                            title: 'Archived',
                            startTime: 1750,
                            endTime: 1850,
                            zone: { name: "Temple of Ahn'Qiraj" },
                            guild: {
                              name: 'Threat Guild',
                              faction: { name: 'Alliance' },
                            },
                            archiveStatus: {
                              isArchived: true,
                              isAccessible: false,
                              archiveDate: 1700,
                            },
                          },
                        ],
                      },
                    },
                  },
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            }

            if (variables.guildID === 77) {
              return new Response(
                JSON.stringify({
                  data: {
                    reportData: {
                      reports: {
                        data: [
                          {
                            code: 'GUILD1',
                            title: 'Guild #1',
                            startTime: 1900,
                            endTime: 1999,
                            zone: { name: 'Blackwing Lair' },
                            guild: {
                              name: 'Threat Guild',
                              faction: { name: 'Alliance' },
                            },
                            archiveStatus: {
                              isArchived: false,
                              isAccessible: true,
                              archiveDate: null,
                            },
                          },
                          {
                            code: 'DUPLICATE',
                            title: 'Shared',
                            startTime: 1800,
                            endTime: 1900,
                            zone: { name: 'Karazhan' },
                            guild: {
                              name: 'Threat Guild',
                              faction: { name: 'Alliance' },
                            },
                            archiveStatus: {
                              isArchived: false,
                              isAccessible: true,
                              archiveDate: null,
                            },
                          },
                          {
                            code: 'INACCESSIBLE',
                            title: 'Inaccessible',
                            startTime: 1700,
                            endTime: 1799,
                            zone: { name: 'Black Temple' },
                            guild: {
                              name: 'Threat Guild',
                              faction: { name: 'Alliance' },
                            },
                            archiveStatus: {
                              isArchived: false,
                              isAccessible: false,
                              archiveDate: null,
                            },
                          },
                        ],
                      },
                    },
                  },
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            }
          }
        }

        return new Response(null, { status: 404 })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = new WCLClient(createMockBindings(), 'wcl:12345')
    const reports = await client.getRecentReports(10)

    expect(reports).toHaveLength(3)
    expect(reports.map((report) => report.code)).toEqual([
      'PERSONAL1',
      'GUILD1',
      'DUPLICATE',
    ])
    expect(reports.some((report) => report.code === 'ARCHIVED-PRIVATE')).toBe(
      false,
    )
    expect(reports.some((report) => report.code === 'INACCESSIBLE')).toBe(false)
    expect(reports[0]).toMatchObject({
      source: 'personal',
      zoneName: 'Naxxramas',
    })
    expect(reports[1]).toMatchObject({
      source: 'guild',
      zoneName: 'Blackwing Lair',
    })
    expect(reports[2]).toMatchObject({
      source: 'personal',
      zoneName: 'Karazhan',
    })
  })

  it('applies the requested limit after merge and dedupe', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()

        if (url.startsWith(firestorePrefix)) {
          return new Response(
            JSON.stringify(await createEncryptedTokenDocument()),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (url.includes('warcraftlogs.com/api/v2/user')) {
          const body = init?.body ? JSON.parse(init.body.toString()) : {}
          const query = body.query as string

          if (query.includes('CurrentUserProfile')) {
            return new Response(
              JSON.stringify({
                data: {
                  userData: {
                    currentUser: {
                      id: 12345,
                      guilds: [],
                    },
                  },
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            )
          }

          if (query.includes('RecentReports')) {
            return new Response(
              JSON.stringify({
                data: {
                  reportData: {
                    reports: {
                      data: [
                        {
                          code: 'RECENT-2',
                          title: 'Recent 2',
                          startTime: 2000,
                          endTime: 2100,
                          zone: { name: 'Naxxramas' },
                          guild: null,
                        },
                        {
                          code: 'RECENT-1',
                          title: 'Recent 1',
                          startTime: 1000,
                          endTime: 1100,
                          zone: { name: 'Molten Core' },
                          guild: null,
                        },
                      ],
                    },
                  },
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            )
          }
        }

        return new Response(null, { status: 404 })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = new WCLClient(createMockBindings(), 'wcl:12345')
    const reports = await client.getRecentReports(1)

    expect(reports).toHaveLength(1)
    expect(reports[0]?.code).toBe('RECENT-2')
  })
})

describe('WCLClient.getGuildReports', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('resolves guild identity and returns recent reports for that guild', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()

        if (url.startsWith(firestorePrefix)) {
          return new Response(
            JSON.stringify(await createEncryptedTokenDocument()),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (url.includes('warcraftlogs.com/api/v2/user')) {
          const body = init?.body ? JSON.parse(init.body.toString()) : {}
          const query = body.query as string
          const variables = body.variables as Record<string, unknown>

          if (query.includes('GuildLookup')) {
            expect(variables.id).toBe(77)
            return new Response(
              JSON.stringify({
                data: {
                  guildData: {
                    guild: {
                      id: 77,
                      name: 'Threat Guild',
                      faction: { name: 'Alliance' },
                      server: {
                        slug: 'benediction',
                        region: { slug: 'US' },
                      },
                    },
                  },
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            )
          }

          if (query.includes('RecentReports')) {
            expect(variables.guildID).toBe(77)
            return new Response(
              JSON.stringify({
                data: {
                  reportData: {
                    reports: {
                      data: [
                        {
                          code: 'GUILD1',
                          title: 'Guild #1',
                          startTime: 1900,
                          endTime: 1999,
                          zone: { name: 'Blackwing Lair' },
                          guild: {
                            name: 'Threat Guild',
                            faction: { name: 'Alliance' },
                          },
                          archiveStatus: {
                            isArchived: false,
                            isAccessible: true,
                            archiveDate: null,
                          },
                        },
                      ],
                    },
                  },
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            )
          }
        }

        return new Response(null, { status: 404 })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = new WCLClient(createMockBindings(), 'wcl:12345')
    const result = await client.getGuildReports({
      guildId: 77,
      limit: 10,
    })

    expect(result.guild).toEqual({
      id: 77,
      name: 'Threat Guild',
      faction: 'Alliance',
      serverSlug: 'benediction',
      serverRegion: 'US',
    })
    expect(result.reports).toEqual([
      {
        code: 'GUILD1',
        title: 'Guild #1',
        startTime: 1900,
        endTime: 1999,
        zoneName: 'Blackwing Lair',
        guildName: 'Threat Guild',
        guildFaction: 'Alliance',
        source: 'guild',
      },
    ])
  })
})
