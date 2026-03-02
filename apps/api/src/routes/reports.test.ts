/**
 * Integration Tests for Reports API
 */
import type { ApiError } from '@/middleware/error'
import type { HealthCheckResponse } from '@/types/bindings'
import { immutableApiCacheVersions } from '@wow-threat/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import mockReportData from '../../test/fixtures/wcl-responses/anniversary-report.json'
import { mockFetch, restoreFetch } from '../../test/helpers/mock-fetch'
import { createMockBindings } from '../../test/setup'
import app from '../index'
import { encryptSecret, importAesGcmKey } from '../services/token-utils'
import type { RecentReportsResponse, ReportResponse } from './reports'

// Extract the actual report object from the nested fixture
const reportData = mockReportData.data.reportData.report
const firestorePrefix =
  'https://firestore.googleapis.com/v1/projects/wow-threat/databases/(default)/documents/'

describe('Reports API', () => {
  beforeEach(() => {
    // Each test starts with default mock
    mockFetch({ report: reportData })
  })

  afterEach(() => {
    restoreFetch()
  })

  describe('GET /v1/reports/:code', () => {
    it('returns report metadata for valid code', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: ReportResponse = await res.json()
      expect(data.code).toBe('ABC123xyz')
      expect(data.title).toBe('Naxxramas 25 - Test Raid')
      expect(data.owner).toBe('TestGuild')
      expect(data.guild).toEqual({
        id: null,
        name: 'TestGuild',
        faction: 'Alliance',
        serverSlug: null,
        serverRegion: null,
      })
      expect(data.gameVersion).toBe(2)
      expect(data.threatConfig).toEqual({
        displayName: 'Vanilla (Era)',
        version: expect.any(Number),
      })
      expect(data.fights).toHaveLength(3)
      expect(data.fights[0]?.encounterID).toBeNull()
      expect(data.actors).toHaveLength(7)
      expect(data.abilities).toHaveLength(3)
      expect(data.abilities[0]).toEqual({
        gameID: 23922,
        icon: 'ability_warrior_shieldslam',
        name: 'Shield Slam',
        type: '1',
      })
    })

    it('returns empty abilities array when report has no ability metadata', async () => {
      mockFetch({
        report: {
          ...reportData,
          masterData: {
            ...reportData.masterData,
            abilities: undefined,
          },
        },
      })

      const res = await app.request(
        'http://localhost/v1/reports/NOABIL999',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: ReportResponse = await res.json()
      expect(data.abilities).toEqual([])
      expect(data.threatConfig).toEqual({
        displayName: 'Vanilla (Era)',
        version: expect.any(Number),
      })
    })

    it('resolves SoD config when report metadata indicates Discovery season', async () => {
      mockFetch({
        report: {
          ...reportData,
          masterData: {
            ...reportData.masterData,
            gameVersion: 2,
          },
          fights: reportData.fights.map((fight) => ({
            ...fight,
            classicSeasonID: 3,
          })),
        },
      })

      const res = await app.request(
        'http://localhost/v1/reports/SOD123xyz',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: ReportResponse = await res.json()
      expect(data.gameVersion).toBe(2)
      expect(data.threatConfig).toEqual({
        displayName: 'Season of Discovery',
        version: expect.any(Number),
      })
    })

    it('resolves TBC for season metadata on 2026-01-13 and later', async () => {
      mockFetch({
        report: {
          ...reportData,
          startTime: Date.UTC(2026, 0, 13, 0, 0, 0, 0),
          masterData: {
            ...reportData.masterData,
            gameVersion: 2,
          },
          fights: reportData.fights.map((fight) => ({
            ...fight,
            classicSeasonID: 5,
          })),
        },
      })

      const res = await app.request(
        'http://localhost/v1/reports/FRESHTBC123',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: ReportResponse = await res.json()
      expect(data.gameVersion).toBe(2)
      expect(data.threatConfig).toEqual({
        displayName: 'TBC (Anniversary)',
        version: expect.any(Number),
      })
    })

    it('resolves TBC for gameVersion 3 season metadata on 2026-01-13 and later', async () => {
      mockFetch({
        report: {
          ...reportData,
          startTime: Date.UTC(2026, 0, 13, 0, 0, 0, 0),
          masterData: {
            ...reportData.masterData,
            gameVersion: 3,
          },
          fights: reportData.fights.map((fight) => ({
            ...fight,
            classicSeasonID: 5,
          })),
        },
      })

      const res = await app.request(
        'http://localhost/v1/reports/FRESHTBCV3',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: ReportResponse = await res.json()
      expect(data.gameVersion).toBe(3)
      expect(data.threatConfig).toEqual({
        displayName: 'TBC (Anniversary)',
        version: expect.any(Number),
      })
    })

    it('returns null threat config for unsupported retail reports', async () => {
      mockFetch({
        report: {
          ...reportData,
          masterData: {
            ...reportData.masterData,
            gameVersion: 1,
          },
        },
      })

      const res = await app.request(
        'http://localhost/v1/reports/RETAIL123',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: ReportResponse = await res.json()
      expect(data.gameVersion).toBe(1)
      expect(data.threatConfig).toBeNull()
    })

    it('resolves era config from era partition metadata', async () => {
      mockFetch({
        report: {
          ...reportData,
          masterData: {
            ...reportData.masterData,
            gameVersion: 2,
          },
          fights: reportData.fights.map((fight) => ({
            ...fight,
            classicSeasonID: undefined,
          })),
          zone: {
            ...reportData.zone,
            partitions: [{ id: 1, name: 'S0' }],
          },
        },
      })

      const res = await app.request(
        'http://localhost/v1/reports/ERA123xyz',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: ReportResponse = await res.json()
      expect(data.gameVersion).toBe(2)
      expect(data.threatConfig).toEqual(
        expect.objectContaining({
          displayName: 'Vanilla (Era)',
        }),
      )
    })

    it('resolves era for phase partitions before 2026-01-13 cutover', async () => {
      mockFetch({
        report: {
          ...reportData,
          startTime: Date.UTC(2026, 0, 12, 23, 59, 59, 999),
          masterData: {
            ...reportData.masterData,
            gameVersion: 2,
          },
          fights: reportData.fights.map((fight) => ({
            ...fight,
            classicSeasonID: undefined,
          })),
          zone: {
            ...reportData.zone,
            partitions: [{ id: 1, name: 'Phase 5' }],
          },
        },
      })

      const res = await app.request(
        'http://localhost/v1/reports/ERAFRESH123',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: ReportResponse = await res.json()
      expect(data.threatConfig).toEqual(
        expect.objectContaining({
          displayName: 'Vanilla (Era)',
        }),
      )
    })

    it('resolves anniversary for phase partitions on 2026-01-13 and later', async () => {
      mockFetch({
        report: {
          ...reportData,
          startTime: Date.UTC(2026, 0, 13, 0, 0, 0, 0),
          masterData: {
            ...reportData.masterData,
            gameVersion: 2,
          },
          fights: reportData.fights.map((fight) => ({
            ...fight,
            classicSeasonID: undefined,
          })),
          zone: {
            ...reportData.zone,
            partitions: [{ id: 1, name: 'Phase 5' }],
          },
        },
      })

      const res = await app.request(
        'http://localhost/v1/reports/TBCFRESH123',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: ReportResponse = await res.json()
      expect(data.threatConfig).toEqual(
        expect.objectContaining({
          displayName: 'TBC (Anniversary)',
        }),
      )
    })

    it('returns 400 for invalid report code format', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/!!!invalid!!!',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(400)

      const data: ApiError = await res.json()
      expect(data.error.code).toBe('INVALID_REPORT_CODE')
    })

    it('returns 502 when WCL API returns error', async () => {
      // Override mock to return no report (simulates WCL API error)
      mockFetch({ report: undefined })

      const res = await app.request(
        'http://localhost/v1/reports/NOTFOUND123',
        {},
        createMockBindings(),
      )

      // WCL returns GraphQL error, which we translate to 502
      expect(res.status).toBe(502)

      const data: ApiError = await res.json()
      expect(data.error.code).toBe('WCL_API_ERROR')
    })

    it('sets revalidation cache headers for unversioned requests', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz',
        {},
        createMockBindings(),
      )

      expect(res.headers.get('Cache-Control')).toContain('must-revalidate')
      expect(res.headers.get('Cache-Control')).not.toContain('immutable')
      expect(res.headers.get('X-Cache-Version')).toBe(
        immutableApiCacheVersions.report,
      )
    })

    it('sets immutable cache headers for versioned requests', async () => {
      const res = await app.request(
        `http://localhost/v1/reports/ABC123xyz?cv=${immutableApiCacheVersions.report}`,
        {},
        createMockBindings(),
      )

      expect(res.headers.get('Cache-Control')).toContain('immutable')
      expect(res.headers.get('X-Cache-Version')).toBe(
        immutableApiCacheVersions.report,
      )
    })
  })

  describe('GET /v1/reports/recent', () => {
    it('returns merged recent report summaries for the authenticated user', async () => {
      const encryptionKey = await importAesGcmKey('test-encryption-key')
      const encryptedAccessToken = await encryptSecret(
        'user-access-token',
        encryptionKey,
      )

      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input.toString()

          if (url.startsWith(firestorePrefix)) {
            return new Response(
              JSON.stringify({
                fields: {
                  accessToken: { stringValue: encryptedAccessToken },
                  accessTokenExpiresAtMs: {
                    integerValue: String(Date.now() + 3_600_000),
                  },
                  refreshToken: { nullValue: null },
                  refreshTokenExpiresAtMs: { nullValue: null },
                  tokenType: { stringValue: 'Bearer' },
                  uid: { stringValue: 'wcl-test-user' },
                  wclUserId: { stringValue: '12345' },
                  wclUserName: { stringValue: 'TestUser' },
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            )
          }

          if (
            url.includes('warcraftlogs.com/api/v2/client') ||
            url.includes('warcraftlogs.com/api/v2/user')
          ) {
            const body = init?.body ? JSON.parse(String(init.body)) : {}
            const query = body.query as string
            const variables = (body.variables ?? {}) as Record<string, unknown>

            if (query.includes('CurrentUserProfile')) {
              return new Response(
                JSON.stringify({
                  data: {
                    userData: {
                      currentUser: {
                        id: 12345,
                        guilds: [{ id: 777 }],
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

            if (query.includes('RecentReports') && variables.userID === 12345) {
              return new Response(
                JSON.stringify({
                  data: {
                    reportData: {
                      reports: {
                        data: [
                          {
                            code: 'PERSONAL-LATEST',
                            title: 'Personal latest',
                            startTime: 2000,
                            endTime: 2100,
                            zone: { name: 'Naxxramas' },
                            guild: {
                              name: 'Threat Guild',
                              faction: { name: 'Alliance' },
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

            if (query.includes('RecentReports') && variables.guildID === 777) {
              return new Response(
                JSON.stringify({
                  data: {
                    reportData: {
                      reports: {
                        data: [
                          {
                            code: 'GUILD-LATEST',
                            title: 'Guild latest',
                            startTime: 1900,
                            endTime: 1999,
                            zone: { name: "Ahn'Qiraj" },
                            guild: {
                              name: 'Threat Guild',
                              faction: { name: 'Alliance' },
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

          return new Response(null, { status: 404 })
        }),
      )

      const res = await app.request(
        'http://localhost/v1/reports/recent?limit=10',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: RecentReportsResponse = await res.json()
      expect(data.reports).toEqual([
        {
          code: 'PERSONAL-LATEST',
          title: 'Personal latest',
          startTime: 2000,
          endTime: 2100,
          zoneName: 'Naxxramas',
          guildName: 'Threat Guild',
          guildFaction: 'Alliance',
          source: 'personal',
        },
        {
          code: 'GUILD-LATEST',
          title: 'Guild latest',
          startTime: 1900,
          endTime: 1999,
          zoneName: "Ahn'Qiraj",
          guildName: 'Threat Guild',
          guildFaction: 'Alliance',
          source: 'guild',
        },
      ])
    })

    it('rejects requests without a linked Warcraft Logs account claim', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/recent?limit=10',
        {
          headers: {
            Authorization: 'Bearer test-firebase-id-token:anon-user',
          },
        },
        createMockBindings(),
      )

      expect(res.status).toBe(401)
    })
  })

  describe('GET /v1/reports/entities/:entityType/reports', () => {
    it('returns guild reports resolved by guild id', async () => {
      const encryptionKey = await importAesGcmKey('test-encryption-key')
      const encryptedAccessToken = await encryptSecret(
        'user-access-token',
        encryptionKey,
      )

      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input.toString()

          if (url.startsWith(firestorePrefix)) {
            return new Response(
              JSON.stringify({
                fields: {
                  accessToken: { stringValue: encryptedAccessToken },
                  accessTokenExpiresAtMs: {
                    integerValue: String(Date.now() + 3_600_000),
                  },
                  refreshToken: { nullValue: null },
                  refreshTokenExpiresAtMs: { nullValue: null },
                  tokenType: { stringValue: 'Bearer' },
                  uid: { stringValue: 'wcl-test-user' },
                  wclUserId: { stringValue: '12345' },
                  wclUserName: { stringValue: 'TestUser' },
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            )
          }

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
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          if (
            url.includes('warcraftlogs.com/api/v2/client') ||
            url.includes('warcraftlogs.com/api/v2/user')
          ) {
            const body = init?.body ? JSON.parse(String(init.body)) : {}
            const query = body.query as string
            const variables = (body.variables ?? {}) as Record<string, unknown>

            if (query.includes('GuildLookup')) {
              expect(variables.id).toBe(777)
              return new Response(
                JSON.stringify({
                  data: {
                    guildData: {
                      guild: {
                        id: 777,
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
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            }

            if (query.includes('RecentReports') && variables.guildID === 777) {
              return new Response(
                JSON.stringify({
                  data: {
                    reportData: {
                      reports: {
                        data: [
                          {
                            code: 'GUILD-LATEST',
                            title: 'Guild latest',
                            startTime: 1900,
                            endTime: 1999,
                            zone: { name: "Ahn'Qiraj" },
                            guild: {
                              name: 'Threat Guild',
                              faction: { name: 'Alliance' },
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

          return new Response(null, { status: 404 })
        }),
      )

      const res = await app.request(
        'http://localhost/v1/reports/entities/guild/reports?guildId=777&limit=10',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data = (await res.json()) as {
        entityType: string
        entity: {
          id: number
          name: string
          faction: string | null
          serverSlug: string | null
          serverRegion: string | null
        }
        reports: Array<{
          code: string
          title: string
          startTime: number
          endTime: number
          zoneName: string | null
          guildName: string | null
          guildFaction: string | null
        }>
      }
      expect(data.entityType).toBe('guild')
      expect(data.entity).toEqual({
        id: 777,
        name: 'Threat Guild',
        faction: 'Alliance',
        serverSlug: 'benediction',
        serverRegion: 'US',
      })
      expect(data.reports).toEqual([
        {
          code: 'GUILD-LATEST',
          title: 'Guild latest',
          startTime: 1900,
          endTime: 1999,
          zoneName: "Ahn'Qiraj",
          guildName: 'Threat Guild',
          guildFaction: 'Alliance',
        },
      ])
    })

    it('allows anonymous firebase auth for guild report discovery via client scope', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          if (url.includes('warcraftlogs.com/api/v2/client')) {
            const body = init?.body ? JSON.parse(String(init.body)) : {}
            const query = body.query as string
            const variables = (body.variables ?? {}) as Record<string, unknown>

            if (query.includes('GuildLookup')) {
              expect(variables.id).toBe(777)
              return new Response(
                JSON.stringify({
                  data: {
                    guildData: {
                      guild: {
                        id: 777,
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
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            }

            if (query.includes('RecentReports') && variables.guildID === 777) {
              return new Response(
                JSON.stringify({
                  data: {
                    reportData: {
                      reports: {
                        data: [
                          {
                            code: 'GUILD-LATEST',
                            title: 'Guild latest',
                            startTime: 1900,
                            endTime: 1999,
                            zone: { name: "Ahn'Qiraj" },
                            guild: {
                              name: 'Threat Guild',
                              faction: { name: 'Alliance' },
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

          return new Response(null, { status: 404 })
        }),
      )

      const res = await app.request(
        'http://localhost/v1/reports/entities/guild/reports?guildId=777&limit=10',
        {
          headers: {
            Authorization: 'Bearer test-firebase-id-token:anon-user',
          },
        },
        createMockBindings(),
      )

      expect(res.status).toBe(200)
    })

    it('returns 400 for unsupported entity types', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/entities/character/reports?entityId=123',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(400)

      const data: ApiError = await res.json()
      expect(data.error.code).toBe('INVALID_ENTITY_TYPE')
    })
  })
})

describe('Health endpoint', () => {
  it('returns ok status', async () => {
    const res = await app.request(
      'http://localhost/health',
      {},
      createMockBindings(),
    )

    expect(res.status).toBe(200)

    const data: HealthCheckResponse = await res.json()
    expect(data.status).toBe('ok')
    expect(data.environment).toBe('test')
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
