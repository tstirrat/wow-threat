/**
 * Integration Tests for Reports API
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import app from '../index'
import { mockFetch, restoreFetch } from '../../test/helpers/mock-fetch'
import { createMockBindings } from '../../test/setup'
import mockReportData from '../../test/fixtures/wcl-responses/anniversary-report.json'

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
        createMockBindings()
      )

      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.code).toBe('ABC123xyz')
      expect(data.title).toBe('Naxxramas 25 - Test Raid')
      expect(data.owner).toBe('TestGuild')
      expect(data.gameVersion).toBe(1)
      expect(data.fights).toHaveLength(3)
      expect(data.actors.players).toHaveLength(4)
      expect(data.actors.enemies).toHaveLength(2)
      expect(data.actors.pets).toHaveLength(1)
    })

    it('returns 400 for invalid report code format', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/!!!invalid!!!',
        {},
        createMockBindings()
      )

      expect(res.status).toBe(400)

      const data = await res.json()
      expect(data.error.code).toBe('INVALID_REPORT_CODE')
    })

    it('returns 502 when WCL API returns error', async () => {
      // Override mock to return no report (simulates WCL API error)
      mockFetch({ report: undefined })

      const res = await app.request(
        'http://localhost/v1/reports/NOTFOUND123',
        {},
        createMockBindings()
      )

      // WCL returns GraphQL error, which we translate to 502
      expect(res.status).toBe(502)

      const data = await res.json()
      expect(data.error.code).toBe('WCL_API_ERROR')
    })

    it('sets immutable cache headers', async () => {
      const res = await app.request(
        'http://localhost/v1/reports/ABC123xyz',
        {},
        createMockBindings()
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
      createMockBindings()
    )

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.status).toBe('ok')
    expect(data.environment).toBe('test')
  })
})
