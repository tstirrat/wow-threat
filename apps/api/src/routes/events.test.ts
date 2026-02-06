/**
 * Integration Tests for Events API
 */
import type { ApiError } from '@/middleware/error'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import anniversaryReport from '../../test/fixtures/wcl-responses/anniversary-report.json'
import { mockFetch, restoreFetch } from '../../test/helpers/mock-fetch'
import { createMockBindings } from '../../test/setup'
import app from '../index'
import type { AugmentedEventsResponse } from './events'

// Sample events fixture
const mockEvents = [
  {
    timestamp: 1000,
    type: 'damage',
    sourceID: 1,
    sourceIsFriendly: true,
    targetID: 25,
    targetIsFriendly: false,
    ability: {
      guid: 23922,
      name: 'Shield Slam',
      type: 1,
      abilityIcon: 'ability_warrior_shieldslam.png',
    },
    amount: 2500,
    absorbed: 0,
    blocked: 0,
    mitigated: 0,
    overkill: 0,
    hitType: 'hit',
    tick: false,
    multistrike: false,
  },
  {
    timestamp: 2000,
    type: 'heal',
    sourceID: 2,
    sourceIsFriendly: true,
    targetID: 1,
    targetIsFriendly: true,
    ability: {
      guid: 25314,
      name: 'Greater Heal',
      type: 2,
      abilityIcon: 'spell_holy_greaterheal.png',
    },
    amount: 4000,
    absorbed: 0,
    overheal: 500,
    tick: false,
  },
  {
    timestamp: 3000,
    type: 'applybuff',
    sourceID: 1,
    sourceIsFriendly: true,
    targetID: 1,
    targetIsFriendly: true,
    ability: {
      guid: 71,
      name: 'Defensive Stance',
      type: 1,
      abilityIcon: 'ability_warrior_defensivestance.png',
    },
  },
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
      expect(data.gameVersion).toBe(1)
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

      expect(damageEvent).toBeDefined()
      expect(damageEvent!.threat).toBeDefined()
      expect(damageEvent!.threat.calculation).toBeDefined()
      expect(damageEvent!.threat.values).toBeDefined()
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
      expect(res.headers.get('X-Game-Version')).toBe('1')
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
      expect(healEvent!.threat.calculation.isSplit).toBe(true)
      expect(healEvent!.threat.values).toBeDefined()

      // Fight 1 (Patchwerk) should only have threat split to Patchwerk (id 25),
      // NOT Grobbulus (id 26) which is in fight 2
      expect(healEvent!.threat.values).toHaveLength(1)
      expect(healEvent!.threat.values[0]?.id).toBe(25)
    })
  })
})
