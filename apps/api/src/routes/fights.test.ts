/**
 * Integration Tests for Fights API
 */
import type { ApiError } from '@/middleware/error'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import mockReportData from '../../test/fixtures/wcl-responses/anniversary-report.json'
import { mockFetch, restoreFetch } from '../../test/helpers/mock-fetch'
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
  })
})
