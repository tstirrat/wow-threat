/**
 * Unit tests for Warcraft Logs URL parsing helpers.
 */
import { describe, expect, it } from 'vitest'

import {
  buildCharacterUrl,
  buildFightRankingsUrl,
  buildGuildUrl,
  parseReportInput,
  parseWarcraftLogsReportUrl,
} from './wcl-url'

describe('wcl-url', () => {
  it('parses supported report URLs', () => {
    expect(
      parseWarcraftLogsReportUrl(
        'https://fresh.warcraftlogs.com/reports/f9yPamzBxQqhGndZ?view=rankings',
      ),
    ).toEqual({
      reportId: 'f9yPamzBxQqhGndZ',
      host: 'fresh.warcraftlogs.com',
    })

    expect(
      parseWarcraftLogsReportUrl(
        'https://sod.warcraftlogs.com/reports/DcCXarqJMBRkTPgA',
      ),
    ).toEqual({
      reportId: 'DcCXarqJMBRkTPgA',
      host: 'sod.warcraftlogs.com',
    })
  })

  it('returns null for unsupported hosts', () => {
    expect(
      parseWarcraftLogsReportUrl('https://www.warcraftlogs.com/reports/ABC123'),
    ).toBeNull()
  })

  it('parses raw report code with fallback host', () => {
    expect(parseReportInput('ABC123xyz', 'vanilla.warcraftlogs.com')).toEqual({
      reportId: 'ABC123xyz',
      host: 'vanilla.warcraftlogs.com',
    })
  })

  it('builds fight summary URL', () => {
    const url = buildFightRankingsUrl('fresh.warcraftlogs.com', 'CODE123', 42)

    expect(url).toContain('fight=42')
    expect(url).toContain('type=summary')
  })

  it('builds character URL', () => {
    const url = buildCharacterUrl('sod.warcraftlogs.com', {
      characterName: 'Grehy',
      region: 'US',
      serverSlug: 'Wild-Growth',
    })

    expect(url).toBe(
      'https://sod.warcraftlogs.com/character/us/wild-growth/grehy',
    )
  })

  it('builds guild URL with numeric guild id when available', () => {
    const url = buildGuildUrl('fresh.warcraftlogs.com', {
      guildId: 777,
      guildName: 'Threat Guild',
      serverRegion: 'US',
      serverSlug: 'Benediction',
    })

    expect(url).toBe('https://fresh.warcraftlogs.com/guild/id/777')
  })

  it('builds guild URL from region/server/name fallback', () => {
    const url = buildGuildUrl('sod.warcraftlogs.com', {
      guildName: 'Threat Guild',
      serverRegion: 'US',
      serverSlug: 'Wild-Growth',
    })

    expect(url).toBe(
      'https://sod.warcraftlogs.com/guild/us/wild-growth/Threat%20Guild',
    )
  })

  it('returns null when guild identity is incomplete', () => {
    expect(
      buildGuildUrl('vanilla.warcraftlogs.com', {
        guildName: 'Threat Guild',
      }),
    ).toBeNull()
  })
})
