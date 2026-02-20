/**
 * Threat Config Integration Helpers
 *
 * Loads config-scoped fixtures and runs them through the shared threat engine.
 */
import { buildThreatEngineInput, processEvents } from '@wow-threat/engine'
import { type Actor, type AugmentedEvent } from '@wow-threat/shared'
import type { ThreatConfig } from '@wow-threat/shared/src/types'
import type { WCLEvent, WCLReportResponse } from '@wow-threat/wcl-types'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveConfig } from '../..'
import {
  hasAnyFightEventsFile,
  resolveFixtureEventsFilePath,
} from './fixture-files'

export interface ConfigFixtureMetadata {
  host: string
  origin?: string
  reportCode: string
  fightId: number
  fightName: string
  gameVersion: number
  downloadedAt: string
  eventCount: number
  eventsFile?: string
  focusActorId?: number
  maxSnapshotLines?: number
}

export interface ConfigFixture {
  metadata: ConfigFixtureMetadata
  report: WCLReportResponse['data']['reportData']['report']
  events: WCLEvent[]
  fixtureName: string
}

export interface ThreatActorTotal {
  actorId: number
  actorName: string
  totalThreat: number
}

export interface SnapshotLineOptions {
  focusActorId?: number
  focusTargetId?: number
  focusTargetInstance?: number
  fightStartTime?: number
  abilityNameMap?: Map<number, string>
  maxLines?: number
  includeEvent?: (
    event: AugmentedEvent,
    actorMap: Map<number, Actor>,
  ) => boolean
}

export interface RunFixtureOptions {
  config?: ThreatConfig
}

export interface RunFixtureResult {
  actorMap: Map<number, Actor>
  augmentedEvents: AugmentedEvent[]
  abilityNameMap: Map<number, string>
  fightStartTime: number
  fightId: number
  fightName: string
}

const fixturesRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../test/fixtures',
)

function fixtureDirectory(fixtureName: string): string {
  return resolve(fixturesRoot, fixtureName)
}

function fixtureFilePath(fixtureName: string, fileName: string): string {
  return resolve(fixtureDirectory(fixtureName), fileName)
}

async function loadJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf8')
  return JSON.parse(content) as T
}

/**
 * Check whether metadata, report, and events files exist for a fixture.
 */
export function hasConfigFixture(fixtureName: string): boolean {
  const directory = fixtureDirectory(fixtureName)

  return (
    existsSync(resolve(directory, 'metadata.json')) &&
    existsSync(resolve(directory, 'report.json')) &&
    hasAnyFightEventsFile(directory)
  )
}

/**
 * Load one config fixture from disk.
 */
export async function loadConfigFixture(
  fixtureName: string,
): Promise<ConfigFixture | null> {
  if (!hasConfigFixture(fixtureName)) {
    return null
  }

  const directory = fixtureDirectory(fixtureName)
  const [metadata, report] = await Promise.all([
    loadJsonFile<ConfigFixtureMetadata>(
      fixtureFilePath(fixtureName, 'metadata.json'),
    ),
    loadJsonFile<WCLReportResponse['data']['reportData']['report']>(
      fixtureFilePath(fixtureName, 'report.json'),
    ),
  ])
  const eventsPath = resolveFixtureEventsFilePath(
    directory,
    metadata.fightId,
    metadata.fightName,
  )
  const events = await loadJsonFile<WCLEvent[]>(eventsPath)

  return {
    metadata,
    report,
    events,
    fixtureName,
  }
}

/**
 * Run the threat engine with the config resolved from fixture report metadata.
 */
export function runConfigFixture(
  fixture: ConfigFixture,
  options: RunFixtureOptions = {},
): RunFixtureResult {
  const fight = fixture.report.fights.find(
    (candidate) => candidate.id === fixture.metadata.fightId,
  )
  if (!fight) {
    throw new Error(
      `Fixture ${fixture.fixtureName} does not include fight ${fixture.metadata.fightId}`,
    )
  }

  const config =
    options.config ??
    resolveConfig({
      report: fixture.report,
    })
  const { actorMap, friendlyActorIds, enemies, abilitySchoolMap } =
    buildThreatEngineInput({
      fight,
      actors: fixture.report.masterData.actors,
      abilities: fixture.report.masterData.abilities,
      rawEvents: fixture.events,
    })

  const { augmentedEvents } = processEvents({
    rawEvents: fixture.events,
    actorMap,
    friendlyActorIds,
    abilitySchoolMap,
    enemies,
    encounterId: fight.encounterID ?? null,
    config,
  })

  return {
    actorMap,
    augmentedEvents,
    abilityNameMap: new Map(
      (fixture.report.masterData.abilities ?? [])
        .filter((ability) => ability.gameID !== null)
        .map((ability) => [ability.gameID!, ability.name ?? 'Unknown Spell']),
    ),
    fightStartTime: fight.startTime,
    fightId: fight.id,
    fightName: fight.name,
  }
}

function formatThreat(value: number): string {
  return value.toFixed(2)
}

function actorName(actorMap: Map<number, Actor>, actorId: number): string {
  return actorMap.get(actorId)?.name ?? `Unknown#${actorId}`
}

function formatRelativeTime(timestamp: number, fightStartTime: number): string {
  const elapsed = Math.max(0, timestamp - fightStartTime)
  const minutes = Math.floor(elapsed / 60000)
  const seconds = Math.floor((elapsed % 60000) / 1000)
  const milliseconds = elapsed % 1000

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

function formatSpellName(
  event: AugmentedEvent,
  abilityNameMap: Map<number, string>,
): string {
  const abilityId = event.abilityGameID
  const spellName =
    abilityId === undefined
      ? 'Unknown Spell'
      : (abilityNameMap.get(abilityId) ?? `Spell ${abilityId}`)

  return `${spellName} (${event.type})`
}

function formatFormula(formula: string): string {
  const normalized = formula.replace(/\s+/g, ' ').trim()
  return normalized.length === 0 ? '-' : normalized
}

function formatModifiers(event: AugmentedEvent): string {
  const modifiers = event.threat?.calculation.modifiers ?? []
  if (modifiers.length === 0) {
    return '-'
  }

  return [...modifiers]
    .sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name)
      if (nameCompare !== 0) {
        return nameCompare
      }

      const sourceCompare = a.source.localeCompare(b.source)
      if (sourceCompare !== 0) {
        return sourceCompare
      }

      return a.value - b.value
    })
    .map(
      (modifier) =>
        `${modifier.name} (${modifier.source}) x${modifier.value.toFixed(2)}`,
    )
    .join(', ')
}

function pad(value: string, width: number): string {
  return value.padEnd(width, ' ')
}

function shouldIncludeWithDefaultFilter(
  event: AugmentedEvent,
  focusActorId: number | undefined,
): boolean {
  if (!shouldIncludeDefault(event, focusActorId)) {
    return false
  }

  if (focusActorId === undefined) {
    return true
  }

  return (event.threat?.changes ?? []).some(
    (change) => change.sourceId === focusActorId,
  )
}

function resolveSourceActorId(
  events: AugmentedEvent[],
  explicitSourceActorId: number | undefined,
): number | null {
  if (explicitSourceActorId !== undefined) {
    return explicitSourceActorId
  }

  for (const event of events) {
    const sourceId = event.threat?.changes?.[0]?.sourceId
    if (sourceId !== undefined) {
      return sourceId
    }
  }

  return null
}

function resolveTargetKey(
  events: AugmentedEvent[],
  sourceActorId: number | null,
  focusTargetId: number | undefined,
  focusTargetInstance: number | undefined,
): { targetId: number; targetInstance: number } | null {
  if (focusTargetId !== undefined) {
    return {
      targetId: focusTargetId,
      targetInstance: focusTargetInstance ?? 0,
    }
  }

  const totalsByTarget = events
    .flatMap((event) => event.threat?.changes ?? [])
    .filter(
      (change) => sourceActorId === null || change.sourceId === sourceActorId,
    )
    .reduce((result, change) => {
      const targetKey = `${change.targetId}:${change.targetInstance}`
      result.set(
        targetKey,
        (result.get(targetKey) ?? 0) + Math.abs(change.amount),
      )
      return result
    }, new Map<string, number>())

  const targetKey = [...totalsByTarget.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0]

  if (!targetKey) {
    return null
  }

  const [targetIdRaw, targetInstanceRaw] = targetKey.split(':')
  return {
    targetId: Number(targetIdRaw),
    targetInstance: Number(targetInstanceRaw),
  }
}

function shouldIncludeDefault(
  event: AugmentedEvent,
  focusActorId: number | undefined,
): boolean {
  if (!event.threat) {
    return false
  }

  const hasThreat =
    (event.threat.changes?.length ?? 0) > 0 ||
    event.threat.calculation.modifiedThreat !== 0

  if (!hasThreat) {
    return false
  }

  if (!focusActorId) {
    return true
  }

  if (event.sourceID === focusActorId) {
    return true
  }

  return (event.threat.changes ?? []).some(
    (change) => change.sourceId === focusActorId,
  )
}

/**
 * Build one-line snapshots for threat events.
 */
export function buildThreatSnapshotLines(
  augmentedEvents: AugmentedEvent[],
  actorMap: Map<number, Actor>,
  options: SnapshotLineOptions = {},
): string {
  const focusActorId = options.focusActorId
  const maxLines = options.maxLines
  const includeEvent = options.includeEvent
  const abilityNameMap = options.abilityNameMap ?? new Map<number, string>()
  const fightStartTime =
    options.fightStartTime ?? augmentedEvents[0]?.timestamp ?? 0

  const filteredEvents = augmentedEvents.filter((event) => {
    if (includeEvent) {
      return includeEvent(event, actorMap)
    }
    return shouldIncludeWithDefaultFilter(event, focusActorId)
  })

  const sourceActorId = resolveSourceActorId(filteredEvents, focusActorId)
  const targetKey = resolveTargetKey(
    filteredEvents,
    sourceActorId,
    options.focusTargetId,
    options.focusTargetInstance,
  )

  if (!targetKey) {
    return 'No threat lines matched snapshot filters'
  }

  const allRows = filteredEvents
    .map((event) => {
      const threat = event.threat
      if (!threat) {
        return null
      }

      const matchingSourceChanges = (threat.changes ?? []).filter(
        (change) => sourceActorId === null || change.sourceId === sourceActorId,
      )

      const targetChange = matchingSourceChanges.find(
        (change) =>
          change.targetId === targetKey.targetId &&
          change.targetInstance === targetKey.targetInstance,
      )

      if (!targetChange) {
        return null
      }

      const splitCount = matchingSourceChanges.length
      const toTarget =
        splitCount > 1
          ? `${formatThreat(threat.calculation.modifiedThreat)} / ${splitCount} = ${formatThreat(targetChange.amount)}`
          : formatThreat(targetChange.amount)

      return {
        time: formatRelativeTime(event.timestamp, fightStartTime),
        spell: formatSpellName(event, abilityNameMap),
        amount: formatThreat(threat.calculation.amount),
        formula: formatFormula(threat.calculation.formula),
        threat: formatThreat(threat.calculation.modifiedThreat),
        toTarget,
        total: formatThreat(targetChange.total),
        modifiers: formatModifiers(event),
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (allRows.length === 0) {
    return 'No threat lines matched snapshot filters'
  }

  const rows =
    maxLines === undefined || maxLines < 0 || allRows.length <= maxLines
      ? allRows
      : allRows.slice(0, maxLines)

  const columns = {
    t: 'T',
    spell: 'Spell',
    amount: 'Amount',
    formula: 'Formula',
    threat: 'Threat',
    toTarget: 'To Target',
    total: 'Total',
    modifiers: 'Multipliers',
  }

  const widths = {
    t: Math.max(columns.t.length, ...rows.map((row) => row.time.length)),
    spell: Math.max(
      columns.spell.length,
      ...rows.map((row) => row.spell.length),
    ),
    amount: Math.max(
      columns.amount.length,
      ...rows.map((row) => row.amount.length),
    ),
    formula: Math.max(
      columns.formula.length,
      ...rows.map((row) => row.formula.length),
    ),
    threat: Math.max(
      columns.threat.length,
      ...rows.map((row) => row.threat.length),
    ),
    toTarget: Math.max(
      columns.toTarget.length,
      ...rows.map((row) => row.toTarget.length),
    ),
    total: Math.max(
      columns.total.length,
      ...rows.map((row) => row.total.length),
    ),
  }

  const headerRow = [
    pad(columns.t, widths.t),
    pad(columns.spell, widths.spell),
    pad(columns.amount, widths.amount),
    pad(columns.formula, widths.formula),
    pad(columns.threat, widths.threat),
    pad(columns.toTarget, widths.toTarget),
    pad(columns.total, widths.total),
    columns.modifiers,
  ].join(' | ')

  const renderedRows = rows.map((row) =>
    [
      pad(row.time, widths.t),
      pad(row.spell, widths.spell),
      pad(row.amount, widths.amount),
      pad(row.formula, widths.formula),
      pad(row.threat, widths.threat),
      pad(row.toTarget, widths.toTarget),
      pad(row.total, widths.total),
      row.modifiers,
    ].join(' | '),
  )

  const sourceIdForHeader = sourceActorId ?? filteredEvents[0]?.sourceID
  const sourceHeader =
    sourceIdForHeader === undefined
      ? 'Source: Unknown'
      : `Source: ${actorName(actorMap, sourceIdForHeader)}#${sourceIdForHeader}`
  const targetHeader = `${actorName(actorMap, targetKey.targetId)} ${targetKey.targetId}:${targetKey.targetInstance}`
  const fightTotal = allRows[allRows.length - 1]?.total ?? '0.00'

  return [
    `Damage to ${targetHeader}`,
    sourceHeader,
    '',
    headerRow,
    '-'.repeat(headerRow.length),
    ...renderedRows,
    '',
    `Fight Total: ${fightTotal}`,
  ].join('\n')
}

/**
 * Aggregate total threat by source actor from threat change amounts.
 */
export function buildActorThreatTotals(
  augmentedEvents: AugmentedEvent[],
  actorMap: Map<number, Actor>,
): ThreatActorTotal[] {
  const totals = augmentedEvents
    .flatMap((event) => event.threat?.changes ?? [])
    .reduce((result, change) => {
      result.set(
        change.sourceId,
        (result.get(change.sourceId) ?? 0) + change.amount,
      )
      return result
    }, new Map<number, number>())

  return [...totals.entries()]
    .map(([actorId, totalThreat]) => ({
      actorId,
      actorName: actorName(actorMap, actorId),
      totalThreat,
    }))
    .sort((a, b) => b.totalThreat - a.totalThreat)
}
