/**
 * Integration Tests for Events API
 */
import type { ApiError } from '@/middleware/error'
import { resolveConfigOrNull } from '@wow-threat/config'
import {
  createAbsorbedEvent,
  createApplyBuffEvent,
  createDamageEvent,
  createHealEvent,
  createRefreshBuffEvent,
  createRemoveBuffEvent,
} from '@wow-threat/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import anniversaryReport from '../../test/fixtures/wcl-responses/anniversary-report.json'
import {
  type MockWCLResponses,
  mockFetch,
  restoreFetch,
} from '../../test/helpers/mock-fetch'
import { createMockBindings } from '../../test/setup'
import app from '../index'
import type { AugmentedEventsResponse } from './events'

// Sample events fixture
const mockEvents = [
  createDamageEvent({
    timestamp: 1000,
    sourceID: 1,
    targetID: 25,
    abilityGameID: 23922,
    amount: 2500,
    absorbed: 0,
    blocked: 0,
    mitigated: 0,
    overkill: 0,
    hitType: 'hit',
    tick: false,
    multistrike: false,
  }),
  createHealEvent({
    timestamp: 2000,
    sourceID: 2,
    targetID: 1,
    abilityGameID: 25314,
    amount: 4000,
    absorbed: 0,
    overheal: 500,
    tick: false,
  }),
  createAbsorbedEvent({
    timestamp: 2500,
    sourceID: 2,
    targetID: 1,
    abilityGameID: 10901,
    amount: 400,
    attackerID: 25,
    extraAbilityGameID: 1,
  }),
  createApplyBuffEvent({
    timestamp: 3000,
    sourceID: 1,
    targetID: 1,
    abilityGameID: 71,
  }),
]

// Extract the actual report object from the fixture
const reportData = anniversaryReport.data.reportData.report
const configVersion = resolveConfigOrNull({
  report: reportData,
})?.version

if (!configVersion) {
  throw new Error('Expected report fixture to resolve a threat config version')
}

interface InferTestPlayer {
  id: number
  name: string
  subType: string
}

function buildInferThreatReductionReport({
  code,
  fightId,
  encounterId,
  players,
  tankPlayerIds,
}: {
  code: string
  fightId: number
  encounterId: number
  players: InferTestPlayer[]
  tankPlayerIds: number[]
}): NonNullable<MockWCLResponses['report']> {
  const firstFight = reportData.fights[0]
  const enemyId = 50

  return {
    ...reportData,
    code,
    fights: [
      {
        bossPercentage: firstFight?.bossPercentage ?? 0,
        classicSeasonID: firstFight?.classicSeasonID,
        difficulty: firstFight?.difficulty ?? null,
        fightPercentage: firstFight?.fightPercentage ?? 0,
        id: fightId,
        kill: firstFight?.kill ?? false,
        encounterID: encounterId,
        name: firstFight?.name ?? 'Infer threat reduction',
        startTime: 1000,
        endTime: 5000,
        friendlyPlayers: players.map((player) => player.id),
        friendlyPets: [],
        enemyNPCs: [
          {
            id: enemyId,
            gameID: 9000,
            instanceCount: 1,
            groupCount: 1,
            petOwner: null,
          },
        ],
        enemyPets: [],
      },
    ],
    masterData: {
      ...reportData.masterData,
      actors: [
        ...players.map((player) => ({
          id: player.id,
          name: player.name,
          petOwner: null,
          subType: player.subType,
          type: 'Player',
        })),
        {
          id: enemyId,
          name: 'Infer Boss',
          petOwner: null,
          subType: 'Boss',
          type: 'NPC',
        },
      ],
      abilities: reportData.masterData.abilities ?? [],
    },
    rankings: {
      data: [
        {
          encounterID: encounterId,
          fightID: fightId,
          roles: {
            tanks: {
              characters: tankPlayerIds
                .map((tankPlayerId) => {
                  const player = players.find(
                    (candidate) => candidate.id === tankPlayerId,
                  )
                  return player ? { id: player.id, name: player.name } : null
                })
                .filter(
                  (character): character is { id: number; name: string } => {
                    return character !== null
                  },
                ),
            },
            dps: {
              characters: players
                .filter((player) => !tankPlayerIds.includes(player.id))
                .map((player) => ({ id: player.id, name: player.name })),
            },
          },
        },
      ],
    },
  } as NonNullable<MockWCLResponses['report']>
}

describe('Events API', () => {
  beforeEach(() => {
    mockFetch({
      report: reportData,
      events: mockEvents,
    })
  })

  afterEach(() => {
    restoreFetch()
  })

  describe('GET /v1/reports/:code/fights/:id/events', () => {
    it('returns events with threat calculations', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/1/events',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: AugmentedEventsResponse = await res.json()
      expect(data.reportCode).toBe('ABC123xyz')
      expect(data.fightId).toBe(1)
      expect(data.fightName).toBe('Patchwerk')
      expect(data.gameVersion).toBe(2)
      expect(data.events).toBeDefined()
      expect(data.initialAurasByActor).toBeDefined()
      expect(data.summary).toBeDefined()
    })

    it('includes threat data for damage events', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/1/events',
        {},
        createMockBindings(),
      )

      const data: AugmentedEventsResponse = await res.json()
      const damageEvent = data.events.find(
        (e: { type: string }) => e.type === 'damage',
      )

      expect(damageEvent).toBeDefined()
      expect(damageEvent!.threat).toBeDefined()
      expect(damageEvent!.threat!.calculation).toBeDefined()
    })

    it('includes threat data for heal events', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/1/events',
        {},
        createMockBindings(),
      )

      const data: AugmentedEventsResponse = await res.json()
      const healEvent = data.events.find(
        (e: { type: string }) => e.type === 'heal',
      )

      expect(healEvent).toBeDefined()
      expect(healEvent!.threat).toBeDefined()
    })

    it('preserves absorbed event passthrough fields', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/1/events',
        {},
        createMockBindings(),
      )

      const data: AugmentedEventsResponse = await res.json()
      const absorbedEvent = data.events.find(
        (e: { type: string }) => e.type === 'absorbed',
      )

      expect(absorbedEvent).toBeDefined()
      expect(absorbedEvent?.attackerID).toBe(25)
      expect(absorbedEvent?.extraAbilityGameID).toBe(1)
      expect(absorbedEvent?.threat?.calculation.isSplit).toBe(false)
    })

    it('returns event counts in summary', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/1/events',
        {},
        createMockBindings(),
      )

      const data: AugmentedEventsResponse = await res.json()
      expect(data.summary.eventCounts).toBeDefined()
      expect(data.summary.duration).toBe(180000)
    })

    it('sets revalidation cache headers for unversioned responses', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/1/events',
        {},
        createMockBindings(),
      )

      expect(res.headers.get('Cache-Control')).toContain('must-revalidate')
      expect(res.headers.get('Cache-Control')).not.toContain('immutable')
      expect(res.headers.get('X-Config-Version')).toBe(configVersion)
      expect(res.headers.get('X-Game-Version')).toBe('2')
    })

    it('sets immutable cache headers for versioned responses', async () => {
      const res = await app.request(
        `http://localhost/v1/reports/ABC123xyz/fights/1/events?configVersion=${configVersion}`,
        {},
        createMockBindings(),
      )

      expect(res.headers.get('Cache-Control')).toContain('immutable')
      expect(res.headers.get('X-Config-Version')).toBe(configVersion)
      expect(res.headers.get('X-Game-Version')).toBe('2')
    })

    it('fetches and merges paginated event pages from WCL', async () => {
      const pageOneEvents = mockEvents.slice(0, 2)
      const pageTwoEvent = createApplyBuffEvent({
        timestamp: 65000,
      })

      mockFetch({
        report: reportData,
        eventsPages: [
          {
            startTime: reportData.fights[0]!.startTime,
            data: pageOneEvents,
            nextPageTimestamp: 30000,
          },
          {
            startTime: 30000,
            data: [pageTwoEvent],
            nextPageTimestamp: null,
          },
        ],
      })

      const res = await app.request(
        'http://localhost/v1/reports/PAGINATION123/fights/1/events?refresh=1',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: AugmentedEventsResponse = await res.json()
      expect(data.events).toHaveLength(3)
      expect(data.summary.totalEvents).toBe(3)
      expect(data.events.some((event) => event.timestamp === 65000)).toBe(true)
    })

    it('returns 404 for non-existent fight', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/999/events',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(404)

      const data: ApiError = await res.json()
      expect(data.error.code).toBe('FIGHT_NOT_FOUND')
    })

    it('returns 400 for unsupported config version', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/1/events?configVersion=not-a-real-version',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(400)

      const data: ApiError = await res.json()
      expect(data.error.code).toBe('INVALID_CONFIG_VERSION')
    })

    it('returns 400 for unsupported game version', async () => {
      const unsupportedGameVersionReport = {
        ...reportData,
        masterData: {
          ...reportData.masterData,
          gameVersion: 999,
        },
      }
      mockFetch({
        report: unsupportedGameVersionReport,
        events: mockEvents,
      })

      const res = await app.request(
        'http://localhost/v1/reports/unsupported-game-version-999/fights/1/events',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(400)

      const data: ApiError = await res.json()
      expect(data.error.code).toBe('INVALID_GAME_VERSION')
      expect(data.error.details).toMatchObject({
        gameVersion: 999,
      })
    })

    it('returns 400 for unsupported retail game version', async () => {
      const retailReport = {
        ...reportData,
        masterData: {
          ...reportData.masterData,
          gameVersion: 1,
        },
      }
      mockFetch({
        report: retailReport,
        events: mockEvents,
      })

      const res = await app.request(
        'http://localhost/v1/reports/retail-not-supported/fights/1/events',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(400)

      const data: ApiError = await res.json()
      expect(data.error.code).toBe('INVALID_GAME_VERSION')
      expect(data.error.details).toMatchObject({
        gameVersion: 1,
      })
    })

    it('resolves SoD config from classic season metadata', async () => {
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
        events: mockEvents,
      })

      const res = await app.request(
        'http://localhost/v1/reports/SOD123xyz/fights/1/events',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: AugmentedEventsResponse = await res.json()
      expect(data.reportCode).toBe('SOD123xyz')
      expect(data.fightId).toBe(1)
      expect(data.fightName).toBe('Patchwerk')
      expect(data.gameVersion).toBe(2)
      expect(data.events).toBeDefined()
      expect(data.summary).toBeDefined()
    })

    it('resolves anniversary config for gameVersion 3 from classic season metadata', async () => {
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
        events: mockEvents,
      })

      const res = await app.request(
        'http://localhost/v1/reports/TBCV3/fights/1/events',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: AugmentedEventsResponse = await res.json()
      expect(data.gameVersion).toBe(3)
      expect(data.events).toBeDefined()
      expect(data.summary).toBeDefined()
    })

    it('returns 400 when classic season metadata is unsupported', async () => {
      mockFetch({
        report: {
          ...reportData,
          masterData: {
            ...reportData.masterData,
            gameVersion: 2,
          },
          fights: reportData.fights.map((fight) => ({
            ...fight,
            classicSeasonID: 42,
          })),
        },
        events: mockEvents,
      })

      const res = await app.request(
        'http://localhost/v1/reports/UNKNOWNSEASON/fights/1/events',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(400)

      const data: ApiError = await res.json()
      expect(data.error.code).toBe('INVALID_GAME_VERSION')
      expect(data.error.details).toMatchObject({
        gameVersion: 2,
      })
    })

    it('treats inferThreatReduction query params as opt-in and keeps cache entries distinct', async () => {
      const inferFightId = 11
      const inferReport = buildInferThreatReductionReport({
        code: 'INFERFLAG1',
        fightId: inferFightId,
        encounterId: 9001,
        players: [
          { id: 1, name: 'Tankadin', subType: 'Paladin' },
          { id: 2, name: 'Bladefury', subType: 'Rogue' },
          { id: 3, name: 'Arrowyn', subType: 'Hunter' },
        ],
        tankPlayerIds: [1],
      })
      mockFetch({
        report: inferReport,
        events: [
          createDamageEvent({
            timestamp: 1500,
            sourceID: 2,
            targetID: 50,
            abilityGameID: 23922,
            amount: 1000,
            absorbed: 0,
            blocked: 0,
            mitigated: 0,
            overkill: 0,
            hitType: 'hit',
            tick: false,
            multistrike: false,
          }),
        ],
      })

      const disabledRequests = [
        `http://localhost/v1/reports/INFERFLAG1/fights/${inferFightId}/events`,
        `http://localhost/v1/reports/INFERFLAG1/fights/${inferFightId}/events?inferThreatReduction=false`,
        `http://localhost/v1/reports/INFERFLAG1/fights/${inferFightId}/events?inferThreatReduction=0`,
      ]

      for (const url of disabledRequests) {
        const disabledResponse = await app.request(
          url,
          {},
          createMockBindings(),
        )
        expect(disabledResponse.status).toBe(200)
        const disabledData: AugmentedEventsResponse =
          await disabledResponse.json()

        expect(disabledData.initialAurasByActor?.['2']).toBeUndefined()
        expect(disabledData.initialAurasByActor?.['3']).toBeUndefined()
      }

      const enabledRequests = [
        `http://localhost/v1/reports/INFERFLAG1/fights/${inferFightId}/events?inferThreatReduction=1`,
        `http://localhost/v1/reports/INFERFLAG1/fights/${inferFightId}/events?inferThreatReduction=true`,
      ]

      for (const url of enabledRequests) {
        const enabledResponse = await app.request(url, {}, createMockBindings())
        expect(enabledResponse.status).toBe(200)
        const enabledData: AugmentedEventsResponse =
          await enabledResponse.json()

        expect(enabledData.initialAurasByActor?.['1']).toBeUndefined()
        expect(enabledData.initialAurasByActor?.['2']).toEqual([25895])
        expect(enabledData.initialAurasByActor?.['3']).toEqual([25895])
      }
    })

    it('always infers initial salvation from remove/refresh without prior apply', async () => {
      const inferFightId = 18
      const inferReport = buildInferThreatReductionReport({
        code: 'SALVEALWAYS1',
        fightId: inferFightId,
        encounterId: 9018,
        players: [
          { id: 1, name: 'Maintank', subType: 'Warrior' },
          { id: 2, name: 'Rogueone', subType: 'Rogue' },
          { id: 3, name: 'Priestone', subType: 'Priest' },
        ],
        tankPlayerIds: [1],
      })
      mockFetch({
        report: inferReport,
        events: [
          createRemoveBuffEvent({
            timestamp: 1600,
            sourceID: 1,
            targetID: 2,
            abilityGameID: 1038,
          }),
          createRefreshBuffEvent({
            timestamp: 1700,
            sourceID: 1,
            targetID: 3,
            abilityGameID: 25895,
          }),
        ],
      })

      const response = await app.request(
        `http://localhost/v1/reports/SALVEALWAYS1/fights/${inferFightId}/events`,
        {},
        createMockBindings(),
      )

      expect(response.status).toBe(200)
      const data: AugmentedEventsResponse = await response.json()
      expect(data.initialAurasByActor?.['1']).toBeUndefined()
      expect(data.initialAurasByActor?.['2']).toEqual([1038])
      expect(data.initialAurasByActor?.['3']).toEqual([25895])
    })

    it('does not infer initial salvation when apply exists before remove/refresh', async () => {
      const inferFightId = 19
      const inferReport = buildInferThreatReductionReport({
        code: 'SALVEALWAYS2',
        fightId: inferFightId,
        encounterId: 9019,
        players: [
          { id: 1, name: 'Maintank', subType: 'Warrior' },
          { id: 2, name: 'Rogueone', subType: 'Rogue' },
          { id: 3, name: 'Priestone', subType: 'Priest' },
        ],
        tankPlayerIds: [1],
      })
      mockFetch({
        report: inferReport,
        events: [
          createApplyBuffEvent({
            timestamp: 1500,
            sourceID: 1,
            targetID: 2,
            abilityGameID: 1038,
          }),
          createRemoveBuffEvent({
            timestamp: 1600,
            sourceID: 1,
            targetID: 2,
            abilityGameID: 1038,
          }),
          createApplyBuffEvent({
            timestamp: 1650,
            sourceID: 1,
            targetID: 3,
            abilityGameID: 25895,
          }),
          createRefreshBuffEvent({
            timestamp: 1700,
            sourceID: 1,
            targetID: 3,
            abilityGameID: 25895,
          }),
        ],
      })

      const response = await app.request(
        `http://localhost/v1/reports/SALVEALWAYS2/fights/${inferFightId}/events`,
        {},
        createMockBindings(),
      )

      expect(response.status).toBe(200)
      const data: AugmentedEventsResponse = await response.json()
      expect(data.initialAurasByActor?.['1']).toBeUndefined()
      expect(data.initialAurasByActor?.['2']).toBeUndefined()
      expect(data.initialAurasByActor?.['3']).toBeUndefined()
    })

    it('resolves tank roles from report rankings in inference mode', async () => {
      const inferFightId = 17
      const inferReport = buildInferThreatReductionReport({
        code: 'INFERTANKIDS',
        fightId: inferFightId,
        encounterId: 9017,
        players: [
          { id: 1, name: 'Maintank', subType: 'Warrior' },
          { id: 2, name: 'Rogueone', subType: 'Rogue' },
          { id: 3, name: 'Palastar', subType: 'Paladin' },
        ],
        tankPlayerIds: [1],
      })
      const fetchMock = mockFetch({
        report: inferReport,
        events: [
          createDamageEvent({
            timestamp: 1500,
            sourceID: 2,
            targetID: 50,
            abilityGameID: 23922,
            amount: 1000,
            absorbed: 0,
            blocked: 0,
            mitigated: 0,
            overkill: 0,
            hitType: 'hit',
            tick: false,
            multistrike: false,
          }),
        ],
      })

      const response = await app.request(
        `http://localhost/v1/reports/INFERTANKIDS/fights/${inferFightId}/events?inferThreatReduction=true`,
        {},
        createMockBindings(),
      )

      expect(response.status).toBe(200)
      const data: AugmentedEventsResponse = await response.json()
      expect(data.initialAurasByActor?.['1']).toBeUndefined()
      expect(data.initialAurasByActor?.['2']).toEqual([25895])
      expect(data.initialAurasByActor?.['3']).toEqual([25895])

      const encounterRoleCalls = fetchMock.mock.calls.filter(([, init]) => {
        if (!init || typeof init !== 'object') {
          return false
        }

        const body =
          'body' in init && init.body ? JSON.parse(String(init.body)) : null
        return typeof body?.query === 'string'
          ? body.query.includes('GetEncounterActorRoles')
          : false
      })
      expect(encounterRoleCalls).toHaveLength(0)
    })

    it('applies minor salvation edge-case precedence while inferring', async () => {
      const inferFightId = 12
      const inferReport = buildInferThreatReductionReport({
        code: 'INFERPALADIN2',
        fightId: inferFightId,
        encounterId: 9002,
        players: [
          { id: 1, name: 'Tankadin', subType: 'Paladin' },
          { id: 2, name: 'Blessedrogue', subType: 'Rogue' },
          { id: 3, name: 'Priestly', subType: 'Priest' },
        ],
        tankPlayerIds: [1],
      })
      const rankingEntries = Array.isArray(inferReport.rankings)
        ? inferReport.rankings
        : (inferReport.rankings?.data ?? [])
      inferReport.rankings = {
        data: rankingEntries.map((ranking) => {
          if (!ranking?.roles?.dps?.characters) {
            return ranking
          }

          return {
            ...ranking,
            roles: {
              ...ranking.roles,
              dps: {
                ...ranking.roles.dps,
                characters: ranking.roles.dps.characters.filter(
                  (character) => character?.id !== 3,
                ),
              },
            },
          }
        }),
      }

      mockFetch({
        report: inferReport,
        events: [
          createDamageEvent({
            timestamp: 1500,
            sourceID: 2,
            targetID: 50,
            abilityGameID: 23922,
            amount: 1000,
            absorbed: 0,
            blocked: 0,
            mitigated: 0,
            overkill: 0,
            hitType: 'hit',
            tick: false,
            multistrike: false,
          }),
          createRemoveBuffEvent({
            timestamp: 1600,
            sourceID: 1,
            targetID: 3,
            abilityGameID: 1038,
          }),
        ],
        friendlyBuffBandsByActor: {
          friendly_2: {
            data: {
              auras: [
                {
                  bands: [{ startTime: 0, endTime: null }],
                  guid: 1038,
                },
              ],
            },
          },
        },
      })

      const response = await app.request(
        `http://localhost/v1/reports/INFERPALADIN2/fights/${inferFightId}/events?inferThreatReduction=true`,
        {},
        createMockBindings(),
      )

      expect(response.status).toBe(200)
      const data: AugmentedEventsResponse = await response.json()
      expect(data.initialAurasByActor?.['1']).toBeUndefined()
      expect(data.initialAurasByActor?.['2']).toEqual([1038])
      expect(data.initialAurasByActor?.['3']).toEqual([1038])
    })

    it('makes no changes without paladins present', async () => {
      const noBuffFightId = 14
      const noBuffReport = buildInferThreatReductionReport({
        code: 'INFERNONE',
        fightId: noBuffFightId,
        encounterId: 9004,
        players: [
          { id: 1, name: 'MainTank', subType: 'Warrior' },
          { id: 2, name: 'Bladefury', subType: 'Rogue' },
          { id: 3, name: 'Arrowyn', subType: 'Hunter' },
        ],
        tankPlayerIds: [1],
      })
      mockFetch({
        report: noBuffReport,
        events: [
          createDamageEvent({
            timestamp: 1500,
            sourceID: 2,
            targetID: 50,
            abilityGameID: 23922,
            amount: 1000,
            absorbed: 0,
            blocked: 0,
            mitigated: 0,
            overkill: 0,
            hitType: 'hit',
            tick: false,
            multistrike: false,
          }),
        ],
      })

      const noBuffResponse = await app.request(
        `http://localhost/v1/reports/INFERNONE/fights/${noBuffFightId}/events?inferThreatReduction=true`,
        {},
        createMockBindings(),
      )
      expect(noBuffResponse.status).toBe(200)
      const noBuffData: AugmentedEventsResponse = await noBuffResponse.json()

      expect(noBuffData.initialAurasByActor?.['1']).toBeUndefined()
      expect(noBuffData.initialAurasByActor?.['2']).toBeUndefined()
      expect(noBuffData.initialAurasByActor?.['3']).toBeUndefined()
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
        events: mockEvents,
      })

      const res = await app.request(
        'http://localhost/v1/reports/ERA123xyz/fights/1/events',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: AugmentedEventsResponse = await res.json()
      expect(data.events.length).toBeGreaterThan(0)
    })

    it('only splits heal threat among enemies in the current fight', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/1/events',
        {},
        createMockBindings(),
      )

      const data: AugmentedEventsResponse = await res.json()
      const healEvent = data.events.find(
        (e: { type: string }) => e.type === 'heal',
      )

      expect(healEvent).toBeDefined()
      expect(healEvent!.threat!.calculation.isSplit).toBe(true)
      expect(healEvent!.threat!.changes).toBeDefined()

      // Fight 1 (Patchwerk) should only have threat split to Patchwerk (id 25),
      // NOT Grobbulus (id 26) which is in fight 2
      expect(healEvent!.threat!.changes).toHaveLength(1)
      expect(healEvent!.threat!.changes?.[0]?.targetId).toBe(25)
    })
  })
})
