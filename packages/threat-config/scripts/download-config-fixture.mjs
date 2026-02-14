#!/usr/bin/env node
/**
 * Download a real WCL fight fixture for threat-config integration tests.
 *
 * Usage:
 *   pnpm --filter @wcl-threat/threat-config fixtures:download -- \
 *     --report-url "https://fresh.warcraftlogs.com/reports/f9yPamzBxQqhGndZ?fight=26&type=damage-done&source=19" \
 *     --name anniversary/naxx/patchwerk-fight-26 \
 *     --focus-actor-id 12
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOSTS = {
  retail: 'https://www.warcraftlogs.com',
  classic: 'https://classic.warcraftlogs.com',
  fresh: 'https://fresh.warcraftlogs.com',
  vanilla: 'https://vanilla.warcraftlogs.com',
  sod: 'https://sod.warcraftlogs.com',
}
const EVENTS_PAGE_LIMIT = 10000

const REPORT_QUERY = `
  query GetReport($code: String!) {
    reportData {
      report(code: $code) {
        code
        title
        owner { name }
        startTime
        endTime
        zone { id name }
        fights {
          id
          encounterID
          name
          startTime
          endTime
          kill
          difficulty
          bossPercentage
          fightPercentage
          enemyNPCs {
            id
            gameID
            instanceCount
            groupCount
            petOwner
          }
          enemyPets {
            id
            gameID
            instanceCount
            groupCount
            petOwner
          }
          friendlyPlayers
          friendlyPets {
            id
            gameID
            instanceCount
            groupCount
            petOwner
          }
        }
        masterData {
          gameVersion
          actors {
            id
            name
            type
            subType
            petOwner
          }
          abilities {
            gameID
            icon
            name
            type
          }
        }
      }
    }
  }
`

const EVENTS_QUERY = `
  query GetEvents($code: String!, $fightId: Int!, $startTime: Float, $endTime: Float, $limit: Int!) {
    reportData {
      report(code: $code) {
        events(
          fightIDs: [$fightId]
          startTime: $startTime
          endTime: $endTime
          limit: $limit
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`

function parseArgs(argv) {
  const args = {}

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token || !token.startsWith('--')) {
      continue
    }

    const key = token.slice(2)
    const value = argv[i + 1]
    if (value && !value.startsWith('--')) {
      args[key] = value
      i++
      continue
    }

    args[key] = 'true'
  }

  return args
}

function resolveHost(hostInput) {
  if (!hostInput) {
    return null
  }

  if (hostInput in HOSTS) {
    return {
      key: hostInput,
      origin: HOSTS[hostInput],
    }
  }

  if (hostInput.startsWith('http://') || hostInput.startsWith('https://')) {
    const url = new URL(hostInput)
    const hostAlias =
      Object.entries(HOSTS).find(
        ([, origin]) => new URL(origin).hostname === url.hostname,
      )?.[0] ?? url.hostname

    return {
      key: hostAlias,
      origin: `${url.protocol}//${url.host}`,
    }
  }

  const hostAlias =
    Object.entries(HOSTS).find(
      ([, origin]) => new URL(origin).hostname === hostInput,
    )?.[0] ?? hostInput

  return {
    key: hostAlias,
    origin: `https://${hostInput}`,
  }
}

function parseReportUrl(reportUrl) {
  let parsedUrl
  try {
    parsedUrl = new URL(reportUrl)
  } catch {
    throw new Error(`Invalid --report-url: ${reportUrl}`)
  }

  const reportMatch = parsedUrl.pathname.match(/\/reports\/([A-Za-z0-9]+)/)
  if (!reportMatch?.[1]) {
    throw new Error(
      'Report URL must include /reports/<REPORT_CODE> in the path',
    )
  }

  const fightId = Number.parseInt(parsedUrl.searchParams.get('fight') ?? '', 10)
  if (!Number.isFinite(fightId)) {
    throw new Error('Report URL must include a valid ?fight=<FIGHT_ID> query')
  }

  return {
    host: parsedUrl.host,
    reportCode: reportMatch[1],
    fightId,
  }
}

function parseDevVars(raw) {
  const vars = {}

  for (const rawLine of raw.split(/\r?\n/u)) {
    const trimmedLine = rawLine.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue
    }

    const line = trimmedLine.startsWith('export ')
      ? trimmedLine.slice('export '.length).trim()
      : trimmedLine

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (key.length > 0) {
      vars[key] = value
    }
  }

  return vars
}

async function loadApiDevVars(packageRoot) {
  const workspaceRoot = resolve(packageRoot, '../..')
  const apiDevVarsPath = resolve(workspaceRoot, 'apps/api/.dev.vars')

  try {
    const raw = await readFile(apiDevVarsPath, 'utf8')
    return parseDevVars(raw)
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    ) {
      return {}
    }

    throw error
  }
}

async function getOAuthToken({ origin, clientId, clientSecret }) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64',
  )
  const response = await fetch(`${origin}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new Error(`OAuth token request failed (${response.status})`)
  }

  const payload = await response.json()
  if (!payload?.access_token || typeof payload.access_token !== 'string') {
    throw new Error('OAuth token response did not include access_token')
  }

  return payload.access_token
}

async function graphql({ origin, token, query, variables }) {
  const response = await fetch(`${origin}/api/v2/client`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  })

  if (!response.ok) {
    throw new Error(`GraphQL request failed (${response.status})`)
  }

  const payload = await response.json()
  if (payload?.errors?.length) {
    const first = payload.errors[0]
    throw new Error(first?.message ?? 'Unknown GraphQL error')
  }

  if (!payload?.data) {
    throw new Error('GraphQL response missing data')
  }

  return payload.data
}

function printUsage() {
  console.log(
    [
      'Usage:',
      '  pnpm --filter @wcl-threat/threat-config fixtures:download -- \\',
      '    --report-url <WCL_REPORT_URL> \\',
      '    [--name <fixture/path>] \\',
      '    [--output <absolute/or/relative/path>] \\',
      '    [--focus-actor-id <ACTOR_ID>] \\',
      '    [--max-snapshot-lines <N>]',
      '',
      'Alternative (legacy args):',
      '  pnpm --filter @wcl-threat/threat-config fixtures:download -- \\',
      '    --host fresh|vanilla|classic|sod|retail|<domain> \\',
      '    --report <REPORT_CODE> \\',
      '    --fight <FIGHT_ID> \\',
      '    [--name <fixture/path>] \\',
      '    [--output <absolute/or/relative/path>] \\',
      '    [--focus-actor-id <ACTOR_ID>] \\',
      '    [--max-snapshot-lines <N>]',
      '',
      'Notes:',
      '  - When --report-url is used, only host/report/fight are parsed from the URL.',
      '  - Source query params in the URL are ignored (all fight events are downloaded).',
      '',
      'Auth:',
      '  Set WCL_CLIENT_ID and WCL_CLIENT_SECRET env vars, or pass',
      '  --client-id / --client-secret.',
      '  If missing, falls back to apps/api/.dev.vars.',
    ].join('\n'),
  )
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help === 'true') {
    printUsage()
    return
  }

  const reportUrl =
    args['report-url'] ??
    (typeof args.report === 'string' &&
    (args.report.startsWith('http://') || args.report.startsWith('https://'))
      ? args.report
      : undefined)

  const parsedReportUrl = reportUrl ? parseReportUrl(reportUrl) : null
  const host = resolveHost(parsedReportUrl?.host ?? args.host)
  const reportCode = parsedReportUrl?.reportCode ?? args.report
  const fightId =
    parsedReportUrl?.fightId ?? Number.parseInt(args.fight ?? '', 10)
  const focusActorIdRaw = args['focus-actor-id']
  const focusActorId = focusActorIdRaw
    ? Number.parseInt(focusActorIdRaw, 10)
    : undefined
  const maxSnapshotLinesRaw = args['max-snapshot-lines']
  const maxSnapshotLines = maxSnapshotLinesRaw
    ? Number.parseInt(maxSnapshotLinesRaw, 10)
    : undefined

  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const apiDevVars = await loadApiDevVars(packageRoot)
  const clientId =
    args['client-id'] ?? process.env.WCL_CLIENT_ID ?? apiDevVars.WCL_CLIENT_ID
  const clientSecret =
    args['client-secret'] ??
    process.env.WCL_CLIENT_SECRET ??
    apiDevVars.WCL_CLIENT_SECRET

  if (
    !host ||
    !reportCode ||
    !Number.isFinite(fightId) ||
    !clientId ||
    !clientSecret
  ) {
    printUsage()
    process.exitCode = 1
    return
  }

  if (focusActorIdRaw && !Number.isFinite(focusActorId)) {
    throw new Error(`Invalid --focus-actor-id: ${focusActorIdRaw}`)
  }

  if (maxSnapshotLinesRaw && !Number.isFinite(maxSnapshotLines)) {
    throw new Error(`Invalid --max-snapshot-lines: ${maxSnapshotLinesRaw}`)
  }

  const fixtureName = args.name ?? `${host.key}/${reportCode}/fight-${fightId}`
  const outputDir = args.output
    ? resolve(process.cwd(), args.output)
    : resolve(packageRoot, 'test/fixtures', fixtureName)

  console.log(`Using host: ${host.origin}`)
  console.log(`Downloading report ${reportCode} fight ${fightId}...`)

  const token = await getOAuthToken({
    origin: host.origin,
    clientId,
    clientSecret,
  })

  const reportData = await graphql({
    origin: host.origin,
    token,
    query: REPORT_QUERY,
    variables: { code: reportCode },
  })

  const report = reportData?.reportData?.report
  if (!report) {
    throw new Error(`Report ${reportCode} was not found`)
  }

  const fight = report.fights.find((candidate) => candidate.id === fightId)
  if (!fight) {
    throw new Error(`Fight ${fightId} was not found in report ${reportCode}`)
  }

  const events = []
  const seenStartTimes = new Set()
  let startTime = fight.startTime

  while (startTime !== null) {
    if (seenStartTimes.has(startTime)) {
      throw new Error(
        `Events pagination stalled at startTime=${startTime} for report ${reportCode} fight ${fightId}`,
      )
    }
    seenStartTimes.add(startTime)

    const eventsData = await graphql({
      origin: host.origin,
      token,
      query: EVENTS_QUERY,
      variables: {
        code: reportCode,
        fightId,
        startTime,
        endTime: fight.endTime,
        limit: EVENTS_PAGE_LIMIT,
      },
    })

    const page = eventsData?.reportData?.report?.events
    if (!page) {
      throw new Error('Events payload did not include report.events')
    }

    if (!Array.isArray(page.data) || page.data.length === 0) {
      break
    }

    events.push(...page.data)

    if (typeof page.nextPageTimestamp === 'number') {
      startTime = page.nextPageTimestamp
      continue
    }

    const pageMaxTimestamp = page.data.reduce(
      (latestTimestamp, event) =>
        Math.max(latestTimestamp, Number(event.timestamp ?? 0)),
      0,
    )
    const appearsTruncated =
      page.data.length >= EVENTS_PAGE_LIMIT && pageMaxTimestamp < fight.endTime

    if (!appearsTruncated) {
      startTime = null
      break
    }

    const fallbackStartTime = Math.max(startTime + 1, pageMaxTimestamp + 1)
    console.warn(
      `Events page reached ${EVENTS_PAGE_LIMIT} rows without nextPageTimestamp; continuing from ${fallbackStartTime}.`,
    )
    startTime = fallbackStartTime
  }

  const metadata = {
    host: host.key,
    origin: host.origin,
    reportCode,
    fightId,
    fightName: fight.name,
    gameVersion: report.masterData.gameVersion,
    downloadedAt: new Date().toISOString(),
    eventCount: events.length,
    focusActorId: Number.isFinite(focusActorId) ? focusActorId : undefined,
    maxSnapshotLines: Number.isFinite(maxSnapshotLines)
      ? maxSnapshotLines
      : undefined,
  }

  await mkdir(outputDir, { recursive: true })
  await Promise.all([
    writeFile(
      resolve(outputDir, 'metadata.json'),
      `${JSON.stringify(metadata, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      resolve(outputDir, 'report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      resolve(outputDir, 'events.json'),
      `${JSON.stringify(events, null, 2)}\n`,
      'utf8',
    ),
  ])

  console.log(`Fixture written to ${outputDir}`)
  console.log(`Fight: ${fight.name}`)
  console.log(`Events: ${events.length}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
