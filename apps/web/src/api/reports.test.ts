/**
 * Tests for report, fight, and events API helpers.
 */
import { configCacheVersion } from '@wow-threat/config'
import { immutableApiCacheVersions } from '@wow-threat/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultApiBaseUrl } from '../lib/constants'
import { requestJson } from './client'
import {
  entityReportsQueryKey,
  fightEventsQueryKey,
  getEntityReports,
  getFight,
  getFightEventsPage,
  getRecentReports,
  getReport,
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

  it('requests raw event pages with cursor when provided', async () => {
    await getFightEventsPage('ABC123xyz', 12, 45000)

    expect(requestJson).toHaveBeenCalledWith(
      `${defaultApiBaseUrl}/v1/reports/ABC123xyz/fights/12/events?cv=${configCacheVersion}&cursor=45000`,
      {
        signal: undefined,
      },
    )
  })

  it('includes config version and inferThreatReduction in fight events query keys', () => {
    expect(fightEventsQueryKey('ABC123xyz', 12, true)).toEqual([
      'fight-events',
      'ABC123xyz',
      12,
      configCacheVersion,
      true,
    ])
  })

  it('requests recent reports with a configurable limit', async () => {
    await getRecentReports(10)

    expect(requestJson).toHaveBeenCalledWith(
      `${defaultApiBaseUrl}/v1/reports/recent?limit=10`,
    )
  })

  it('includes limit in recent reports query keys', () => {
    expect(recentReportsQueryKey(10, 'wcl:12345')).toEqual([
      'recent-reports',
      10,
      'wcl:12345',
    ])
  })

  it('requests guild entity reports with guild id and limit', async () => {
    await getEntityReports({
      entityType: 'guild',
      guildId: 777,
      limit: 15,
    })

    expect(requestJson).toHaveBeenCalledWith(
      `${defaultApiBaseUrl}/v1/reports/entities/guild/reports?limit=15&guildId=777`,
    )
  })

  it('includes entity lookup values in entity reports query keys', () => {
    expect(
      entityReportsQueryKey(
        {
          entityType: 'guild',
          guildId: 777,
          guildName: 'Threat Guild',
          serverSlug: 'benediction',
          serverRegion: 'US',
          limit: 20,
        },
        'wcl:12345',
      ),
    ).toEqual([
      'entity-reports',
      'guild',
      777,
      'Threat Guild',
      'benediction',
      'US',
      20,
      'wcl:12345',
    ])
  })

  it('includes cv in report metadata requests', async () => {
    await getReport('ABC123xyz')

    expect(requestJson).toHaveBeenCalledWith(
      `${defaultApiBaseUrl}/v1/reports/ABC123xyz?cv=${immutableApiCacheVersions.report}`,
    )
  })

  it('includes cv in fight metadata requests', async () => {
    await getFight('ABC123xyz', 12)

    expect(requestJson).toHaveBeenCalledWith(
      `${defaultApiBaseUrl}/v1/reports/ABC123xyz/fights/12?cv=${immutableApiCacheVersions.fight}`,
    )
  })
})
