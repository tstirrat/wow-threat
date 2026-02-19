#!/usr/bin/env node
/**
 * Threat Config Report CLI
 *
 * Generates threat snapshot reports from cached fixtures or downloaded report data.
 */
import type { ThreatConfig } from '@wcl-threat/shared'
import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  anniversaryConfig,
  eraConfig,
  resolveConfigOrNull,
  sodConfig,
} from '../..'
import { resolveFixtureEventsFilePath } from './fixture-files'
import {
  type ConfigFixture,
  buildThreatSnapshotLines,
  runConfigFixture,
} from './helpers'
import {
  buildDefaultReportFilename,
  findCachedFixtureByReportFight,
  parseReportCliArgs,
  reportCliUsage,
} from './report-cli-utils'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const fixturesRoot = resolve(packageRoot, 'src/test/fixtures')

function configFromHost(host: string | undefined): ThreatConfig | null {
  const normalizedHost = host?.toLowerCase()
  if (!normalizedHost) {
    return null
  }

  if (
    normalizedHost === 'sod' ||
    normalizedHost.includes('sod.warcraftlogs.com')
  ) {
    return sodConfig
  }

  if (
    normalizedHost === 'fresh' ||
    normalizedHost.includes('fresh.warcraftlogs.com')
  ) {
    return anniversaryConfig
  }

  if (
    normalizedHost === 'vanilla' ||
    normalizedHost.includes('vanilla.warcraftlogs.com')
  ) {
    return eraConfig
  }

  if (
    normalizedHost === 'classic' ||
    normalizedHost.includes('classic.warcraftlogs.com')
  ) {
    return anniversaryConfig
  }

  return null
}

function resolveRunConfig(
  fixture: ConfigFixture,
  configArg: 'auto' | 'era' | 'anniversary' | 'sod',
): ThreatConfig {
  if (configArg === 'era') {
    return eraConfig
  }

  if (configArg === 'anniversary') {
    return anniversaryConfig
  }

  if (configArg === 'sod') {
    return sodConfig
  }

  const resolvedConfig = resolveConfigOrNull({
    report: fixture.report,
  })
  if (resolvedConfig) {
    return resolvedConfig
  }

  const hostMappedConfig = configFromHost(fixture.metadata.host)
  if (hostMappedConfig) {
    console.warn(
      `Resolver could not infer a unique config for gameVersion ${fixture.report.masterData.gameVersion}. Falling back to --host mapping (${fixture.metadata.host}).`,
    )
    return hostMappedConfig
  }

  throw new Error(
    `Could not resolve config for report ${fixture.metadata.reportCode}. Re-run with --config era|anniversary|sod.`,
  )
}

async function loadFixtureFromDirectory(
  fixtureDirectory: string,
  fixtureName: string,
  fightId: number,
): Promise<ConfigFixture> {
  const [metadataRaw, reportRaw] = await Promise.all([
    readFile(resolve(fixtureDirectory, 'metadata.json'), 'utf8'),
    readFile(resolve(fixtureDirectory, 'report.json'), 'utf8'),
  ])
  const metadata = JSON.parse(metadataRaw) as ConfigFixture['metadata']
  const report = JSON.parse(reportRaw) as ConfigFixture['report']
  const fight = report.fights.find((candidate) => candidate.id === fightId)
  if (!fight) {
    throw new Error(
      `Report ${metadata.reportCode} does not include fight ${fightId}`,
    )
  }

  const eventsPath = resolveFixtureEventsFilePath(
    fixtureDirectory,
    fightId,
    fight.name,
  )
  const eventsRaw = await readFile(eventsPath, 'utf8')
  const events = JSON.parse(eventsRaw) as ConfigFixture['events']

  return {
    fixtureName,
    metadata: {
      ...metadata,
      fightId: fight.id,
      fightName: fight.name,
      eventCount: events.length,
    },
    report,
    events,
  }
}

function runPnpmFixturesDownload(args: { reportUrl: string }): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      'pnpm',
      ['fixtures:download', '--', '--report-url', args.reportUrl],
      {
        cwd: packageRoot,
        stdio: 'inherit',
      },
    )

    child.on('error', (error) => {
      rejectPromise(error)
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      rejectPromise(
        new Error(`fixtures:download failed with exit code ${code ?? -1}`),
      )
    })
  })
}

async function main(): Promise<void> {
  const args = parseReportCliArgs(process.argv.slice(2))
  if (args.help) {
    console.log(reportCliUsage())
    return
  }

  let fixtureMatch = await findCachedFixtureByReportFight(
    fixturesRoot,
    args.reportCode,
    args.fightId,
  )

  if (!fixtureMatch) {
    console.log(
      `No cached fixture for ${args.reportCode} fight ${args.fightId}. Downloading from ${args.reportHost}...`,
    )
    await runPnpmFixturesDownload({
      reportUrl: args.reportUrl,
    })

    fixtureMatch = await findCachedFixtureByReportFight(
      fixturesRoot,
      args.reportCode,
      args.fightId,
    )

    if (!fixtureMatch) {
      throw new Error(
        `Downloaded fixture could not be located for ${args.reportCode} fight ${args.fightId}`,
      )
    }
  }

  const fixture = await loadFixtureFromDirectory(
    fixtureMatch.fixtureDirectory,
    fixtureMatch.fixtureName,
    args.fightId,
  )

  const config = resolveRunConfig(fixture, args.config)
  const { actorMap, augmentedEvents, abilityNameMap, fightStartTime } =
    runConfigFixture(fixture, { config })

  const snapshot = buildThreatSnapshotLines(augmentedEvents, actorMap, {
    focusActorId: args.targetId,
    focusTargetId: args.enemyId,
    focusTargetInstance: args.targetInstance,
    abilityNameMap,
    fightStartTime,
    maxLines: args.maxLines ?? fixture.metadata.maxSnapshotLines,
  })
  const output = [
    `newthreat`,
    `Report URL: ${args.reportUrl}`,
    `Report Code: ${args.reportCode}`,
    '',
    snapshot,
  ].join('\n')

  const playerName =
    actorMap.get(args.targetId)?.name ?? `actor-${args.targetId}`
  const enemyName =
    actorMap.get(args.enemyId)?.name ?? fixture.metadata.fightName

  const shouldWriteFile = args.output !== undefined || !args.stdout
  const outputPath = args.output
    ? resolve(process.cwd(), args.output)
    : resolve(
        fixtureMatch.fixtureDirectory,
        buildDefaultReportFilename(playerName, enemyName),
      )

  if (shouldWriteFile) {
    await writeFile(outputPath, `${output}\n`, 'utf8')
    console.log(`Report written to ${outputPath}`)
  }

  if (args.stdout) {
    console.log(output)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  console.error('')
  console.error(reportCliUsage())
  process.exitCode = 1
})
