/**
 * Integration Tests for Reports API
 */
import type { ApiError } from '@/middleware/error'
import type { HealthCheckResponse } from '@/types/bindings'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import mockReportData from '../../test/fixtures/wcl-responses/anniversary-report.json'
import { mockFetch, restoreFetch } from '../../test/helpers/mock-fetch'
import { createMockBindings } from '../../test/setup'
import app from '../index'
import type { ReportResponse } from './reports'

// Extract the actual report object from the nested fixture
const reportData = mockReportData.data.reportData.report

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
      expect(data.gameVersion).toBe(2)
      expect(data.threatConfig).toEqual({
        displayName: 'TBC (Anniversary)',
        version: expect.any(String),
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
        displayName: 'TBC (Anniversary)',
        version: expect.any(String),
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
        version: expect.any(String),
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

    it('sets immutable cache headers', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz',
        {},
        createMockBindings(),
      )

      expect(res.headers.get('Cache-Control')).toContain('immutable')
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
