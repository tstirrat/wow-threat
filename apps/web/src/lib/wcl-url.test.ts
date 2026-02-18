/**
 * Unit tests for Warcraft Logs URL parsing helpers.
 */
import { describe, expect, it } from 'vitest'

import {
  buildFightRankingsUrl,
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
})
