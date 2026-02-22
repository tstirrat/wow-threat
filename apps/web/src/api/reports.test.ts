/**
 * Tests for report, fight, and events API helpers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultApiBaseUrl } from '../lib/constants'
import { requestJson } from './client'
import {
  fightEventsQueryKey,
  getFightEvents,
  getRecentReports,
  recentReportsQueryKey,
} from './reports'

vi.mock('./client', () => ({
  requestJson: vi.fn(),
}))

describe('reports api helpers', () => {
  beforeEach(() => {
    vi.mocked(requestJson).mockReset()
    vi.mocked(requestJson).mockResolvedValue({} as never)
  })

  it('includes configVersion in fight events requests when available', async () => {
    await getFightEvents('ABC123xyz', 12, '1.3.1')

    expect(requestJson).toHaveBeenCalledWith(
      `${defaultApiBaseUrl}/v1/reports/ABC123xyz/fights/12/events?configVersion=1.3.1`,
    )
  })

  it('omits configVersion in fight events requests when unavailable', async () => {
    await getFightEvents('ABC123xyz', 12, null)

    expect(requestJson).toHaveBeenCalledWith(
      `${defaultApiBaseUrl}/v1/reports/ABC123xyz/fights/12/events`,
    )
  })

  it('includes configVersion in fight events query keys', () => {
    expect(fightEventsQueryKey('ABC123xyz', 12, '1.3.1')).toEqual([
      'fight-events',
      'ABC123xyz',
      12,
      '1.3.1',
    ])
  })

  it('requests recent reports with a configurable limit', async () => {
    await getRecentReports(10)

    expect(requestJson).toHaveBeenCalledWith(
      `${defaultApiBaseUrl}/v1/reports/recent?limit=10`,
    )
  })

  it('includes limit in recent reports query keys', () => {
    expect(recentReportsQueryKey(10)).toEqual(['recent-reports', 10])
  })
})
