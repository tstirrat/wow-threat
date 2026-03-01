/**
 * Integration Tests for Events API (raw passthrough mode).
 */
import type { ApiError } from '@/middleware/error'
import { configCacheVersion, resolveConfigOrNull } from '@wow-threat/config'
import { createDamageEvent, createHealEvent } from '@wow-threat/shared'
import { HitTypeCode } from '@wow-threat/wcl-types'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import anniversaryReport from '../../test/fixtures/wcl-responses/anniversary-report.json'
import { mockFetch, restoreFetch } from '../../test/helpers/mock-fetch'
import { createMockBindings } from '../../test/setup'
import app from '../index'
import type { FightEventsResponse } from '../types/api'

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
    hitType: HitTypeCode.Hit,
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
]

const reportData = anniversaryReport.data.reportData.report
const configVersion = resolveConfigOrNull({
  report: reportData,
})?.version

if (!configVersion) {
  throw new Error('Expected report fixture to resolve a threat config version')
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
    it('returns raw event page payload by default', async () => {
      const res = await app.request(
        `http://localhost/v1/reports/ABC123xyz/fights/1/events?cv=${configCacheVersion}`,
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)
      expect(res.headers.get('X-Events-Mode')).toBe('raw')
      expect(res.headers.get('X-Next-Page-Timestamp')).toBe('')
      expect(res.headers.get('X-Game-Version')).toBe('2')
      expect(res.headers.get('X-Config-Version')).toBe(configCacheVersion)

      const data: FightEventsResponse = await res.json()
      expect(data.reportCode).toBe('ABC123xyz')
      expect(data.fightId).toBe(1)
      expect(data.fightName).toBe('Patchwerk')
      expect(data.gameVersion).toBe(2)
      expect(data.configVersion).toBe(configCacheVersion)
      expect(data.events).toHaveLength(2)
      expect(data.events[0]?.type).toBe('damage')
      expect(data.events[0]).toMatchObject({
        abilityGameID: 23922,
      })
      expect(data.nextPageTimestamp).toBeNull()
      expect(data.initialAurasByActor).toBeDefined()
    })

    it('keeps raw event fields without plucking', async () => {
      const firstFight = reportData.fights[0]
      const rawPageEvent = {
        abilityGameID: 23922,
        amount: 2500,
        customRawField: 'preserve-me',
        sourceID: 1,
        targetID: 25,
        timestamp: 2100,
        type: 'damage',
      }

      mockFetch({
        report: reportData,
        eventsPages: [
          {
            startTime: firstFight?.startTime,
            data: [rawPageEvent],
            nextPageTimestamp: 31000,
          },
        ],
      })

      const res = await app.request(
        `http://localhost/v1/reports/RAWPAGE1/fights/1/events?cv=${configCacheVersion}&refresh=1`,
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: FightEventsResponse = await res.json()
      expect(data.events).toHaveLength(1)
      expect(data.events[0]).toMatchObject(rawPageEvent)
      expect(data.nextPageTimestamp).toBe(31000)
    })

    it('respects raw page cursor', async () => {
      const cursor = 45000
      const cursorPageEvent = createDamageEvent({
        timestamp: cursor + 10,
      })

      mockFetch({
        report: reportData,
        eventsPages: [
          {
            startTime: cursor,
            data: [cursorPageEvent],
            nextPageTimestamp: null,
          },
        ],
      })

      const res = await app.request(
        `http://localhost/v1/reports/RAWCURSOR1/fights/1/events?cursor=${cursor}&refresh=1`,
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data: FightEventsResponse = await res.json()
      expect(data.events).toHaveLength(1)
      expect(data.events[0]?.timestamp).toBe(cursor + 10)
      expect(data.nextPageTimestamp).toBeNull()
    })

    it('returns 400 for invalid raw events cursor', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/1/events?cursor=abc',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(400)

      const data: ApiError = await res.json()
      expect(data.error.code).toBe('INVALID_EVENTS_CURSOR')
    })

    it('sets revalidation cache headers for unversioned responses', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/1/events',
        {},
        createMockBindings(),
      )

      expect(res.headers.get('Cache-Control')).toContain('must-revalidate')
      expect(res.headers.get('Cache-Control')).not.toContain('immutable')
      expect(res.headers.get('X-Config-Version')).toBe(configCacheVersion)
      expect(res.headers.get('X-Game-Version')).toBe('2')
    })

    it('sets immutable cache headers for versioned responses', async () => {
      const res = await app.request(
        `http://localhost/v1/reports/ABC123xyz/fights/1/events?cv=${configCacheVersion}`,
        {},
        createMockBindings(),
      )

      expect(res.headers.get('Cache-Control')).toContain('immutable')
      expect(res.headers.get('X-Config-Version')).toBe(configCacheVersion)
      expect(res.headers.get('X-Game-Version')).toBe('2')
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
        'http://localhost/v1/reports/ABC123xyz/fights/1/events?cv=not-a-real-version',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(400)

      const data: ApiError = await res.json()
      expect(data.error.code).toBe('INVALID_CONFIG_VERSION')
    })

    it('rejects non-cache-tag config version values', async () => {
      const res = await app.request(
        `http://localhost/v1/reports/ABC123xyz/fights/1/events?cv=${configVersion}`,
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(400)

      const data: ApiError = await res.json()
      expect(data.error.code).toBe('INVALID_CONFIG_VERSION')
    })

    it('returns 400 for unsupported game version', async () => {
      mockFetch({
        report: {
          ...reportData,
          masterData: {
            ...reportData.masterData,
            gameVersion: 999,
          },
        },
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
  })
})
