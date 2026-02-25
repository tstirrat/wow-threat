/**
 * Integration Tests for Fights API
 */
import type { ApiError } from '@/middleware/error'
import { immutableApiCacheVersions } from '@wow-threat/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import mockReportData from '../../test/fixtures/wcl-responses/anniversary-report.json'
import {
  createMockFetch,
  mockFetch,
  restoreFetch,
} from '../../test/helpers/mock-fetch'
import { createMockBindings } from '../../test/setup'
import app from '../index'
import type { FightsResponse } from './fights'

// Extract the actual report object from the fixture
const reportData = mockReportData.data.reportData.report

describe('Fights API', () => {
  beforeEach(() => {
    mockFetch({ report: reportData })
  })

  afterEach(() => {
    restoreFetch()
  })

  describe('GET /v1/reports/:code/fights/:id', () => {
    it('returns fight details for valid fight ID', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/1',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)

      const data = await res.json<FightsResponse>()
      expect(data.id).toBe(1)
      expect(data.name).toBe('Patchwerk')
      expect(data.kill).toBe(true)
      expect(data.startTime).toBe(0)
      expect(data.endTime).toBe(180000)
    })

    it('returns 400 for non-numeric fight ID', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/abc',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(400)

      const data = await res.json<ApiError>()
      expect(data.error.code).toBe('INVALID_FIGHT_ID')
    })

    it('returns 404 when fight not found in report', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/999',
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(404)

      const data = await res.json<ApiError>()
      expect(data.error.code).toBe('FIGHT_NOT_FOUND')
    })

    it('returns actors categorized by type', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/1',
        {},
        createMockBindings(),
      )

      const data = await res.json<FightsResponse>()
      expect(data.actors).toBeDefined()
      expect(data.enemies).toBeDefined()
      expect(
        data.enemies.some((e: { name: string }) => e.name === 'Patchwerk'),
      ).toBe(true)
    })

    it('returns player roles when encounter rankings are available', async () => {
      const roleReportCode = 'ROLE123xyz'
      mockFetch({
        report: {
          ...reportData,
          code: roleReportCode,
          fights: reportData.fights.map((fight) =>
            fight.id === 1 ? { ...fight, encounterID: 111 } : fight,
          ),
        },
        encounterActorRoles: [
          {
            encounterID: 111,
            fightID: 1,
            roles: {
              tanks: {
                characters: [{ id: 1, name: 'Tankwarrior' }],
              },
              healers: {
                characters: [{ id: 2, name: 'Healpriest' }],
              },
            },
          },
        ],
      })

      const res = await app.request(
        `http://localhost/v1/reports/${roleReportCode}/fights/1`,
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)
      const data = await res.json<FightsResponse>()

      expect(data.actors.find((actor) => actor.id === 1)?.role).toBe('Tank')
      expect(data.actors.find((actor) => actor.id === 2)?.role).toBe('Healer')
      expect(data.actors.find((actor) => actor.id === 3)?.role).toBeUndefined()
    })

    it('uses fight-scoped report rankings without encounter-role fallback query', async () => {
      const roleReportCode = 'ROLE456xyz'
      const fetchMock = createMockFetch({
        report: {
          ...reportData,
          code: roleReportCode,
          fights: reportData.fights.map((fight) =>
            fight.id === 1 ? { ...fight, encounterID: 111 } : fight,
          ),
          rankings: {
            data: [
              {
                encounterID: 111,
                fightID: 1,
                roles: {
                  tanks: {
                    characters: [{ id: 1, name: 'Tankwarrior' }],
                  },
                },
              },
            ],
          },
        },
      })
      vi.stubGlobal('fetch', fetchMock)

      const res = await app.request(
        `http://localhost/v1/reports/${roleReportCode}/fights/1`,
        {},
        createMockBindings(),
      )

      expect(res.status).toBe(200)
      const data = await res.json<FightsResponse>()
      expect(data.actors.find((actor) => actor.id === 1)?.role).toBe('Tank')

      const encounterRoleCalls = fetchMock.mock.calls.filter((call) => {
        const body = call[1]?.body
        if (!body) {
          return false
        }

        const query = JSON.parse(body.toString()).query as string
        return query.includes('GetEncounterActorRoles')
      })
      expect(encounterRoleCalls).toHaveLength(0)
    })

    it('returns wipe fight correctly', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/3',
        {},
        createMockBindings(),
      )

      const data = await res.json<FightsResponse>()
      expect(data.id).toBe(3)
      expect(data.name).toBe('Gluth')
      expect(data.kill).toBe(false)
    })

    it('sets revalidation cache headers for unversioned requests', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz/fights/1',
        {},
        createMockBindings(),
      )

      expect(res.headers.get('Cache-Control')).toContain('must-revalidate')
      expect(res.headers.get('Cache-Control')).not.toContain('immutable')
      expect(res.headers.get('X-Cache-Version')).toBe(
        immutableApiCacheVersions.fight,
      )
    })

    it('sets immutable cache headers for versioned requests', async () => {
      const res = await app.request(
        `http://localhost/v1/reports/ABC123xyz/fights/1?cv=${immutableApiCacheVersions.fight}`,
        {},
        createMockBindings(),
      )

      expect(res.headers.get('Cache-Control')).toContain('immutable')
      expect(res.headers.get('X-Cache-Version')).toBe(
        immutableApiCacheVersions.fight,
      )
    })
  })
})
