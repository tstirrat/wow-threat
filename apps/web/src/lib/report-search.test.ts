/**
 * Unit tests for merged report-search document builders and fuzzy ranking.
 */
import { describe, expect, it } from 'vitest'

import {
  buildReportSearchDocuments,
  createReportSearchIndex,
  searchReportDocuments,
} from './report-search'

describe('report search helpers', () => {
  it('deduplicates by report id and excludes inaccessible recent entries', () => {
    const documents = buildReportSearchDocuments({
      starredReports: [
        {
          reportId: 'ABC123',
          title: 'Starred raid',
          sourceHost: 'fresh.warcraftlogs.com',
          starredAt: 10,
          guildName: 'Threat Guild',
          guildFaction: 'Alliance',
          zoneName: 'Naxxramas',
        },
      ],
      recentReports: [
        {
          reportId: 'ABC123',
          title: 'Recent raid',
          sourceHost: 'sod.warcraftlogs.com',
          lastOpenedAt: 20,
          guildName: 'Threat Guild',
          guildFaction: 'Alliance',
          zoneName: 'Naxxramas',
          isAccessible: true,
          isArchived: false,
        },
        {
          reportId: 'ARCHIVE1',
          title: 'Archived report',
          sourceHost: 'fresh.warcraftlogs.com',
          lastOpenedAt: 30,
          guildName: null,
          guildFaction: null,
          zoneName: null,
          isAccessible: false,
          isArchived: true,
        },
      ],
      personalReports: [],
      guildReports: [],
      includeExamples: false,
    })

    expect(documents).toHaveLength(1)
    expect(documents[0]?.reportId).toBe('ABC123')
    expect(documents[0]?.sourceHost).toBe('fresh.warcraftlogs.com')
    expect(documents[0]?.sourceTags).toEqual(['starred', 'recent'])
  })

  it('returns source-priority defaults when query is empty', () => {
    const documents = buildReportSearchDocuments({
      starredReports: [],
      recentReports: [
        {
          reportId: 'RECENT1',
          title: 'Recent report',
          sourceHost: 'fresh.warcraftlogs.com',
          lastOpenedAt: 10,
        },
      ],
      personalReports: [
        {
          code: 'PERSONAL1',
          title: 'Personal report',
          startTime: 100,
          endTime: 120,
          zoneName: 'Blackwing Lair',
          guildName: 'Threat Guild',
          guildFaction: 'Alliance',
          source: 'personal',
        },
      ],
      guildReports: [],
      includeExamples: false,
    })

    const index = createReportSearchIndex(documents)
    const results = searchReportDocuments(index, documents, '')
    expect(results.map((entry) => entry.reportId)).toEqual([
      'RECENT1',
      'PERSONAL1',
    ])
  })

  it('matches fuzzy queries against zone and guild aliases', () => {
    const documents = buildReportSearchDocuments({
      starredReports: [],
      recentReports: [
        {
          reportId: 'NAXX01',
          title: 'Threat Regression Raid',
          sourceHost: 'fresh.warcraftlogs.com',
          lastOpenedAt: 10,
          guildName: 'Threat Officer Guild',
          guildFaction: 'Alliance',
          zoneName: 'Naxxramas',
        },
      ],
      personalReports: [],
      guildReports: [],
      includeExamples: false,
    })

    const index = createReportSearchIndex(documents)
    expect(searchReportDocuments(index, documents, 'naxx')[0]?.reportId).toBe(
      'NAXX01',
    )
    expect(
      searchReportDocuments(index, documents, 'officer')[0]?.reportId,
    ).toBe('NAXX01')
  })

  it('adds zone-derived boss aliases so boss names can match report suggestions', () => {
    const documents = buildReportSearchDocuments({
      starredReports: [],
      recentReports: [
        {
          reportId: 'KARA01',
          title: 'kara thursday log',
          sourceHost: 'fresh.warcraftlogs.com',
          lastOpenedAt: 10,
          guildName: 'Threat Guild',
          guildFaction: 'Alliance',
          zoneName: 'Karazhan',
        },
      ],
      personalReports: [],
      guildReports: [],
      includeExamples: false,
    })

    const index = createReportSearchIndex(documents)
    const [firstResult] = searchReportDocuments(index, documents, 'nightbane')

    expect(firstResult?.reportId).toBe('KARA01')
    expect(firstResult?.matchedAliases).toContain('Nightbane')
  })
})
