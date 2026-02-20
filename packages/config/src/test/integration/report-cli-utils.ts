/**
 * Threat Config Report CLI Utilities
 *
 * Parses CLI arguments, resolves fixture cache entries, and builds output names.
 */
import { readFile, readdir } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'

import { hasFightEventsFile } from './fixture-files'
import type { ConfigFixtureMetadata } from './helpers'

export interface ReportCliHelpArgs {
  help: true
}

export interface ReportCliRunArgs {
  help: false
  reportUrl: string
  reportHost: string
  reportCode: string
  fightId: number
  enemyId: number
  targetId: number
  targetInstance: number
  config: 'auto' | 'era' | 'anniversary' | 'sod'
  maxLines?: number
  output?: string
  stdout: boolean
}

export type ReportCliArgs = ReportCliHelpArgs | ReportCliRunArgs

export interface CachedFixtureMatch {
  fixtureName: string
  fixtureDirectory: string
  metadata: ConfigFixtureMetadata
}

function parseRawArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token || !token.startsWith('--')) {
      continue
    }

    const key = token.slice(2)
    const nextToken = argv[index + 1]
    if (nextToken && !nextToken.startsWith('--')) {
      args[key] = nextToken
      index += 1
      continue
    }

    args[key] = 'true'
  }

  return args
}

function parseNumber(value: string | undefined, flag: string): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Missing or invalid ${flag}`)
  }

  return parsed
}

function parseReportUrl(reportUrl: string): {
  reportHost: string
  reportCode: string
  fightId: number
  targetId: number
} {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(reportUrl)
  } catch {
    throw new Error('Invalid --report URL')
  }

  const reportPathMatch = parsedUrl.pathname.match(/\/reports\/([A-Za-z0-9]+)/)
  if (!reportPathMatch?.[1]) {
    throw new Error('Report URL must include /reports/<REPORT_CODE>')
  }

  const fightIdRaw = parsedUrl.searchParams.get('fight')
  const sourceIdRaw = parsedUrl.searchParams.get('source')

  if (!fightIdRaw) {
    throw new Error('Report URL must include ?fight=<FIGHT_ID>')
  }

  if (!sourceIdRaw) {
    throw new Error('Report URL must include ?source=<SOURCE_ACTOR_ID>')
  }

  return {
    reportHost: parsedUrl.host,
    reportCode: reportPathMatch[1],
    fightId: parseNumber(fightIdRaw, 'report fight param'),
    targetId: parseNumber(sourceIdRaw, 'report source param'),
  }
}

/**
 * Parse and validate report CLI arguments.
 */
export function parseReportCliArgs(argv: string[]): ReportCliArgs {
  const rawArgs = parseRawArgs(argv)

  if (rawArgs.help === 'true') {
    return { help: true }
  }

  const reportUrl = rawArgs.report
  if (!reportUrl) {
    throw new Error('Missing required --report')
  }

  const { reportHost, reportCode, fightId, targetId } =
    parseReportUrl(reportUrl)
  const enemyId = parseNumber(rawArgs['enemy-id'], '--enemy-id')

  const targetInstanceRaw = rawArgs['target-instance']
  const targetInstance = targetInstanceRaw
    ? parseNumber(targetInstanceRaw, '--target-instance')
    : 0

  const configRaw = rawArgs.config ?? 'auto'
  const validConfigOptions = new Set(['auto', 'era', 'anniversary', 'sod'])
  if (!validConfigOptions.has(configRaw)) {
    throw new Error(`Invalid --config: ${configRaw}`)
  }

  const maxLinesRaw = rawArgs['max-lines']
  const maxLines = maxLinesRaw
    ? parseNumber(maxLinesRaw, '--max-lines')
    : undefined

  return {
    help: false,
    reportUrl,
    reportHost,
    reportCode,
    fightId,
    enemyId,
    targetId,
    targetInstance,
    config: configRaw as ReportCliRunArgs['config'],
    maxLines,
    output: rawArgs.output,
    stdout: rawArgs.stdout === 'true',
  }
}

/**
 * Render report CLI usage text.
 */
export function reportCliUsage(): string {
  return [
    'Usage:',
    '  pnpm --filter @wow-threat/config report:debug -- \\',
    '    --report <WCL_REPORT_URL> \\',
    '    --enemy-id <ENEMY_ACTOR_ID> \\',
    '    [--target-instance <INSTANCE>] \\',
    '    [--config auto|era|anniversary|sod] \\',
    '    [--max-lines <N>] \\',
    '    [--output <file/path.txt>] \\',
    '    [--stdout]',
    '',
    'Notes:',
    '  - Searches src/test/fixtures cache first by report + fight.',
    '  - If missing, reuses fixtures:download and infers host from the report URL.',
    '  - URL must include fight and source query params.',
    '  - --enemy-id is the enemy target actor; source actor comes from URL ?source=.',
  ].join('\n')
}

/**
 * Sanitize a string for stable output filenames.
 */
export function sanitizeFileSegment(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized.length > 0 ? normalized : 'unknown'
}

/**
 * Build default output filename in fixture directories.
 */
export function buildDefaultReportFilename(
  playerName: string,
  bossName: string,
): string {
  return `report-${sanitizeFileSegment(playerName)}-${sanitizeFileSegment(bossName)}.txt`
}

async function listMetadataFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })

  const directMatches = entries
    .filter((entry) => entry.isFile() && entry.name === 'metadata.json')
    .map((entry) => resolve(directory, entry.name))

  const nestedMatches = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => listMetadataFiles(resolve(directory, entry.name))),
  )

  return [...directMatches, ...nestedMatches.flat()]
}

async function readFixtureMetadata(
  metadataPath: string,
): Promise<ConfigFixtureMetadata | null> {
  try {
    const raw = await readFile(metadataPath, 'utf8')
    return JSON.parse(raw) as ConfigFixtureMetadata
  } catch {
    return null
  }
}

/**
 * Find a cached fixture directory by report code and fight id.
 */
export async function findCachedFixtureByReportFight(
  fixturesRoot: string,
  reportCode: string,
  fightId: number,
): Promise<CachedFixtureMatch | null> {
  const metadataFiles = await listMetadataFiles(fixturesRoot).catch(() => [])

  const matches = await Promise.all(
    metadataFiles.map(async (metadataPath) => {
      const metadata = await readFixtureMetadata(metadataPath)
      if (!metadata) {
        return null
      }

      if (metadata.reportCode !== reportCode) {
        return null
      }

      const fixtureDirectory = dirname(metadataPath)
      const hasRequestedFightEvents = hasFightEventsFile(
        fixtureDirectory,
        fightId,
      )

      if (!hasRequestedFightEvents) {
        return null
      }

      const fixtureName = relative(fixturesRoot, fixtureDirectory)
        .split(sep)
        .join('/')

      return {
        fixtureName,
        fixtureDirectory,
        metadata,
      }
    }),
  )

  return (
    matches.find((match): match is CachedFixtureMatch => match !== null) ?? null
  )
}
