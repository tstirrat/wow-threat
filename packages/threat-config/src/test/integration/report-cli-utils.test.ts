/**
 * Report CLI Utility Tests
 *
 * Verifies argument parsing, fixture cache lookup, and output naming.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  buildDefaultReportFilename,
  findCachedFixtureByReportFight,
  parseReportCliArgs,
} from './report-cli-utils'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirectories.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
  tempDirectories.length = 0
})

describe('parseReportCliArgs', () => {
  it('parses valid required arguments', () => {
    const result = parseReportCliArgs([
      '--report',
      'https://fresh.warcraftlogs.com/reports/f9yPamzBxQqhGndZ?fight=26&type=damage-done&source=19',
      '--enemy-id',
      '203',
      '--stdout',
    ])

    if (result.help) {
      throw new Error('expected run args')
    }

    expect(result.reportCode).toBe('f9yPamzBxQqhGndZ')
    expect(result.reportHost).toBe('fresh.warcraftlogs.com')
    expect(result.fightId).toBe(26)
    expect(result.enemyId).toBe(203)
    expect(result.targetId).toBe(19)
    expect(result.targetInstance).toBe(0)
    expect(result.config).toBe('auto')
    expect(result.stdout).toBe(true)
  })

  it('throws when required args are missing', () => {
    expect(() =>
      parseReportCliArgs([
        '--report',
        'https://fresh.warcraftlogs.com/reports/f9yPamzBxQqhGndZ?fight=26&source=19',
      ]),
    ).toThrow('Missing or invalid --enemy-id')
  })

  it('throws when report url does not include fight and source', () => {
    expect(() =>
      parseReportCliArgs([
        '--report',
        'https://fresh.warcraftlogs.com/reports/f9yPamzBxQqhGndZ',
        '--enemy-id',
        '203',
      ]),
    ).toThrow('Report URL must include ?fight=<FIGHT_ID>')
  })
})

describe('buildDefaultReportFilename', () => {
  it('creates sanitized report filenames', () => {
    expect(buildDefaultReportFilename('Treadwell', 'Patchwerk')).toBe(
      'report-treadwell-patchwerk.txt',
    )
    expect(buildDefaultReportFilename('A B C', 'Boss #1')).toBe(
      'report-a-b-c-boss-1.txt',
    )
  })
})

describe('findCachedFixtureByReportFight', () => {
  it('finds matching fixture metadata by report and fight', async () => {
    const fixturesRoot = await mkdtemp(
      resolve(tmpdir(), 'threat-config-fixtures-'),
    )
    tempDirectories.push(fixturesRoot)

    const fixtureDirectory = resolve(
      fixturesRoot,
      'anniversary/naxx/patchwerk-fight-26',
    )
    await mkdir(fixtureDirectory, { recursive: true })

    await writeFile(
      resolve(fixtureDirectory, 'metadata.json'),
      `${JSON.stringify(
        {
          host: 'fresh',
          reportCode: 'f9yPamzBxQqhGndZ',
          fightId: 26,
          fightName: 'Patchwerk',
          gameVersion: 20,
          downloadedAt: '2026-02-14T00:00:00.000Z',
          eventCount: 123,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )

    const match = await findCachedFixtureByReportFight(
      fixturesRoot,
      'f9yPamzBxQqhGndZ',
      26,
    )

    expect(match?.fixtureName).toBe('anniversary/naxx/patchwerk-fight-26')
    expect(match?.metadata.fightName).toBe('Patchwerk')
  })
})
