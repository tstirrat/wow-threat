/**
 * Integration Tests for Events API
 */
import type { ApiError } from '@/middleware/error'
import {
  createAbsorbedEvent,
  createApplyBuffEvent,
  createDamageEvent,
  createHealEvent,
} from '@wcl-threat/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import anniversaryReport from '../../test/fixtures/wcl-responses/anniversary-report.json'
import { mockFetch, restoreFetch } from '../../test/helpers/mock-fetch'
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
      console.warn('ghere', damageEvent)

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

    it('sets cache headers on response', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/1/events',
        {},
        createMockBindings(),
      )

      expect(res.headers.get('Cache-Control')).toContain('immutable')
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
