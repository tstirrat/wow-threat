/**
 * Threat data transformation helpers for report rankings and fight chart series.
 */
import type { AugmentedEvent, SpellId, ThreatConfig } from '@wow-threat/shared'
import type { CombatantInfoAura, PlayerClass } from '@wow-threat/wcl-types'

import type {
  AugmentedEventsResponse,
  ReportAbilitySummary,
  ReportActorSummary,
} from '../types/api'
import type {
  FightTarget,
  FightTargetOption,
  FocusedPlayerSummary,
  FocusedPlayerThreatRow,
  InitialAuraDisplay,
  PlayerSummaryRow,
  ThreatPointMarkerKind,
  ThreatPointModifier,
  ThreatSeries,
  ThreatStateVisualKind,
  ThreatStateVisualSegment,
  ThreatStateWindow,
} from '../types/app'
import { getActorColor, getClassColor } from './class-colors'

const trackableActorTypes = new Set(['Player', 'Pet'])
const bossMeleeSpellId = 1
const markerPriorityByKind: Record<ThreatPointMarkerKind, number> = {
  bossMelee: 1,
  death: 2,
}
const spellSchoolByMask = {
  1: 'physical',
  2: 'holy',
  4: 'fire',
  8: 'nature',
  16: 'frost',
  32: 'shadow',
  64: 'arcane',
} as const
const knownSpellSchools = new Set(Object.values(spellSchoolByMask))

interface SeriesAccumulator {
  actorId: number
  actorName: string
  actorClass: PlayerClass | null
  actorType: 'Player' | 'Pet'
  ownerId: number | null
  label: string
  color: string
  points: ThreatSeries['points']
  maxThreat: number
  totalThreat: number
  totalDamage: number
  totalHealing: number
  stateVisualSegments: ThreatStateVisualSegment[]
  fixateWindows: ThreatStateWindow[]
  invulnerabilityWindows: ThreatStateWindow[]
}

export interface ReportPlayerRanking {
  actorId: number
  actorName: string
  actorClass: PlayerClass | null
  color: string
  totalThreat: number
  fightCount: number
  perFight: Record<number, number>
}

interface ThreatStateTransition {
  actorId: number
  kind: ThreatStateVisualKind
  phase: 'start' | 'end'
  spellId: number
  spellName: string | null
  timeMs: number
  sequence: number
}

interface ActiveThreatState {
  key: string
  kind: ThreatStateVisualKind
  spellId: number
  spellName: string | null
  startMs: number
  sequence: number
}

interface ActorStateVisuals {
  stateVisualSegments: ThreatStateVisualSegment[]
  fixateWindows: ThreatStateWindow[]
  invulnerabilityWindows: ThreatStateWindow[]
}

interface ModifierVariantAccumulator {
  modifiers: ThreatPointModifier[]
  totalThreat: number
}

const defaultTargetInstance = 0

function ensureEncounterStartPoint(
  accumulator: SeriesAccumulator,
  fightStartTime: number,
): void {
  if (accumulator.points.length > 0) {
    return
  }

  accumulator.points.push({
    timestamp: fightStartTime,
    timeMs: 0,
    totalThreat: 0,
    threatDelta: 0,
    amount: 0,
    baseThreat: 0,
    modifiedThreat: 0,
    spellSchool: null,
    eventType: 'start',
    abilityName: 'Encounter start',
    formula: 'n/a',
    modifiers: [],
  })
}

function isBossMeleeMarkerEventForTarget({
  event,
  target,
}: {
  event: AugmentedEventsResponse['events'][number]
  target: FightTarget
}): boolean {
  const hasBossMeleeMarker = (event.threat?.calculation.effects ?? []).some(
    (effect) => effect.type === 'eventMarker' && effect.marker === 'bossMelee',
  )
  const isLegacyBossMeleeEvent =
    event.type === 'damage' && event.abilityGameID === bossMeleeSpellId

  return (
    (hasBossMeleeMarker || isLegacyBossMeleeEvent) &&
    event.sourceID === target.id &&
    (event.sourceInstance ?? defaultTargetInstance) === target.instance
  )
}

function resolveEventPointMarkers({
  event,
  target,
  actorsById,
}: {
  event: AugmentedEventsResponse['events'][number]
  target: FightTarget
  actorsById: Map<number, ReportActorSummary>
}): Map<number, ThreatPointMarkerKind> {
  const markersByActorId = new Map<number, ThreatPointMarkerKind>()
  const eventEffects = event.threat?.calculation.effects ?? []

  const setMarker = ({
    actorId,
    markerKind,
  }: {
    actorId: number
    markerKind: ThreatPointMarkerKind
  }): void => {
    const actor = actorsById.get(actorId)
    if (!actor || !trackableActorTypes.has(actor.type)) {
      return
    }

    const existing = markersByActorId.get(actorId)
    if (
      existing &&
      markerPriorityByKind[existing] > markerPriorityByKind[markerKind]
    ) {
      return
    }

    markersByActorId.set(actorId, markerKind)
  }

  if (isBossMeleeMarkerEventForTarget({ event, target })) {
    setMarker({
      actorId: event.targetID,
      markerKind: 'bossMelee',
    })
  }

  const hasDeathMarker = eventEffects.some(
    (effect) => effect.type === 'eventMarker' && effect.marker === 'death',
  )
  if (hasDeathMarker || event.type === 'death') {
    setMarker({
      actorId: event.targetID,
      markerKind: 'death',
    })
  }

  return markersByActorId
}

function resolveInvulnerabilityStartActorIds({
  event,
  actorsById,
}: {
  event: AugmentedEventsResponse['events'][number]
  actorsById: Map<number, ReportActorSummary>
}): Set<number> {
  const actorIds = new Set<number>()

  ;(event.threat?.calculation.effects ?? []).forEach((effect) => {
    if (effect.type !== 'state') {
      return
    }

    if (
      effect.state.kind !== 'invulnerable' ||
      effect.state.phase !== 'start'
    ) {
      return
    }

    const actor = actorsById.get(effect.state.actorId)
    if (!actor || !trackableActorTypes.has(actor.type)) {
      return
    }

    actorIds.add(effect.state.actorId)
  })

  return actorIds
}

function getAuraSpellId(aura: CombatantInfoAura): number | null {
  const abilityGameId =
    typeof aura.abilityGameID === 'number' ? aura.abilityGameID : null
  if (abilityGameId && abilityGameId > 0) {
    return abilityGameId
  }

  const legacyAura = aura as CombatantInfoAura & { ability?: number }
  const ability =
    typeof legacyAura.ability === 'number' ? legacyAura.ability : null
  if (ability && ability > 0) {
    return ability
  }

  return null
}

function buildAbilityNameMap(
  abilities: ReportAbilitySummary[] | undefined,
): Map<number, string> {
  if (!abilities || abilities.length === 0) {
    return new Map()
  }

  return abilities.reduce((result, ability) => {
    if (
      typeof ability.gameID === 'number' &&
      ability.gameID > 0 &&
      typeof ability.name === 'string' &&
      ability.name.trim().length > 0
    ) {
      result.set(ability.gameID, ability.name)
    }

    return result
  }, new Map<number, string>())
}

function resolveActorClass(
  actor: ReportActorSummary,
  actorsById: Map<number, ReportActorSummary>,
): PlayerClass | null {
  if (actor.type === 'Player') {
    return (actor.subType as PlayerClass | undefined) ?? null
  }

  if (actor.type === 'Pet' && actor.petOwner) {
    const owner = actorsById.get(actor.petOwner)
    if (owner?.type === 'Player') {
      return (owner.subType as PlayerClass | undefined) ?? null
    }
  }

  return null
}

function buildActorLabel(
  actor: ReportActorSummary,
  actorsById: Map<number, ReportActorSummary>,
): string {
  if (actor.type === 'Pet' && actor.petOwner) {
    const owner = actorsById.get(actor.petOwner)
    if (owner) {
      return `${actor.name} (${owner.name})`
    }
  }

  return actor.name
}

function buildTargetKey(target: FightTarget): string {
  return `${target.id}:${target.instance}`
}

function buildTargetLabel({
  name,
  displayId,
  instance,
  hasMultipleInstances,
}: {
  name: string
  displayId: number
  instance: number
  hasMultipleInstances: boolean
}): string {
  const formattedId = hasMultipleInstances
    ? `${displayId}.${instance}`
    : String(displayId)

  return `${name} (${formattedId})`
}

function compareTargetsByName(
  left: FightTargetOption,
  right: FightTargetOption,
): number {
  const byName = left.name.localeCompare(right.name)
  if (byName !== 0) {
    return byName
  }

  const byInstance = left.instance - right.instance
  if (byInstance !== 0) {
    return byInstance
  }

  return left.id - right.id
}

function normalizeThreatModifiers(
  modifiers:
    | Array<{
        name: string
        value: number
        schoolMask?: unknown
      }>
    | undefined,
): ThreatPointModifier[] {
  if (!modifiers?.length) {
    return []
  }

  return modifiers.map((modifier) => {
    const fromSchoolMaskField = (() => {
      const value = Number(modifier.schoolMask)
      if (!Number.isFinite(value)) {
        return []
      }

      return resolveSchoolLabelsFromMask(value)
    })()

    const schoolMatch = modifier.name.match(/\((?<school>[^)]+)\)$/i)
    const fromName =
      schoolMatch?.groups?.school &&
      knownSpellSchools.has(schoolMatch.groups.school.trim().toLowerCase())
        ? [schoolMatch.groups.school.trim().toLowerCase()]
        : []
    const schoolLabels = [...new Set([...fromSchoolMaskField, ...fromName])]
    const normalizedName =
      schoolMatch && fromName.length > 0
        ? modifier.name.slice(0, schoolMatch.index).trim()
        : modifier.name

    return {
      name: normalizedName,
      schoolLabels,
      value: modifier.value,
    }
  })
}

function createAbilityMap(
  abilities: ReportAbilitySummary[],
): Map<number, ReportAbilitySummary> {
  return new Map(
    abilities
      .filter((ability) => ability.gameID !== null)
      .map((ability) => [ability.gameID as number, ability]),
  )
}

function resolveStateSpellName(
  spellId: number,
  abilityById: Map<number, ReportAbilitySummary>,
): string | null {
  if (!Number.isFinite(spellId) || spellId <= 0) {
    return null
  }

  const spellName = abilityById.get(spellId)?.name?.trim()
  if (spellName) {
    return spellName
  }

  return null
}

function parseAbilitySchoolMask(type: string | null): number {
  if (!type) {
    return 0
  }

  const mask = Number.parseInt(type, 10)
  if (!Number.isFinite(mask)) {
    return 0
  }

  return mask
}

function resolveSchoolLabelsFromMask(mask: number): string[] {
  return [1, 2, 4, 8, 16, 32, 64]
    .filter((schoolMask) => (mask & schoolMask) !== 0)
    .map(
      (schoolMask) =>
        spellSchoolByMask[schoolMask as keyof typeof spellSchoolByMask],
    )
}

function isVisibleModifierValue(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value - 1) > 0.0005
}

function createModifierSignature(modifier: ThreatPointModifier): string {
  const schoolsKey = [...modifier.schoolLabels].sort().join('/')
  return `${modifier.name}|${schoolsKey}|${modifier.value.toFixed(6)}`
}

function createModifierVariantKey(modifiers: ThreatPointModifier[]): string {
  if (modifiers.length === 0) {
    return 'none'
  }

  return modifiers
    .map((modifier) => createModifierSignature(modifier))
    .sort()
    .join('||')
}

function buildAppliedModifiersForFocusedActor({
  events,
  sourceIds,
}: {
  events: AugmentedEventsResponse['events']
  sourceIds: Set<number>
}): FocusedPlayerSummary['modifiers'] {
  const modifierCountsByKey = new Map<
    string,
    FocusedPlayerSummary['modifiers'][number] & {
      count: number
    }
  >()

  events.forEach((event) => {
    const hasMatchingSource = (event.threat?.changes ?? []).some((change) =>
      sourceIds.has(change.sourceId),
    )
    if (!hasMatchingSource) {
      return
    }

    ;(event.threat?.calculation.modifiers ?? []).forEach((rawModifier) => {
      const modifier = normalizeThreatModifiers([rawModifier])[0]
      if (!modifier || !isVisibleModifierValue(modifier.value)) {
        return
      }

      const key = createModifierSignature(modifier)
      const existing = modifierCountsByKey.get(key)

      if (existing) {
        existing.count += 1
        if (
          !existing.spellId &&
          typeof rawModifier.sourceId === 'number' &&
          rawModifier.sourceId > 0
        ) {
          existing.spellId = rawModifier.sourceId
        }
        return
      }

      modifierCountsByKey.set(key, {
        key,
        name: modifier.name,
        ...(typeof rawModifier.sourceId === 'number' && rawModifier.sourceId > 0
          ? { spellId: rawModifier.sourceId }
          : {}),
        schoolLabels: modifier.schoolLabels,
        value: modifier.value,
        count: 1,
      })
    })
  })

  return [...modifierCountsByKey.values()]
    .sort((left, right) => {
      const byCount = right.count - left.count
      if (byCount !== 0) {
        return byCount
      }

      const byDistance = Math.abs(right.value - 1) - Math.abs(left.value - 1)
      if (byDistance !== 0) {
        return byDistance
      }

      return left.name.localeCompare(right.name)
    })
    .map((modifier) => ({
      key: modifier.key,
      ...(modifier.spellId ? { spellId: modifier.spellId } : {}),
      name: modifier.name,
      schoolLabels: modifier.schoolLabels,
      value: modifier.value,
    }))
}

function resolveRelativeTimeMs(
  timestamp: number,
  fightStartTime: number,
  firstTimestamp: number,
): number {
  const byFightStart = timestamp - fightStartTime
  if (byFightStart >= 0) {
    return byFightStart
  }

  return Math.max(0, timestamp - firstTimestamp)
}

function isThreatStateVisualKind(
  value: string,
): value is ThreatStateVisualKind {
  return value === 'fixate' || value === 'aggroLoss' || value === 'invulnerable'
}

function clampTimeMs(value: number, max: number): number {
  return Math.min(Math.max(0, value), max)
}

function mergeStateWindows(windows: ThreatStateWindow[]): ThreatStateWindow[] {
  if (windows.length === 0) {
    return []
  }

  const sorted = [...windows]
    .filter((window) => window.endMs > window.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  if (sorted.length === 0) {
    return []
  }

  return sorted.reduce<ThreatStateWindow[]>((accumulator, window) => {
    const previous = accumulator[accumulator.length - 1]
    if (!previous) {
      accumulator.push({ ...window })
      return accumulator
    }

    if (window.startMs <= previous.endMs) {
      previous.endMs = Math.max(previous.endMs, window.endMs)
      return accumulator
    }

    accumulator.push({ ...window })
    return accumulator
  }, [])
}

function mergeStateVisualSegments(
  segments: ThreatStateVisualSegment[],
): ThreatStateVisualSegment[] {
  if (segments.length === 0) {
    return []
  }

  const sorted = [...segments]
    .filter((segment) => segment.endMs > segment.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  if (sorted.length === 0) {
    return []
  }

  return sorted.reduce<ThreatStateVisualSegment[]>((accumulator, segment) => {
    const previous = accumulator[accumulator.length - 1]
    if (!previous) {
      accumulator.push({ ...segment })
      return accumulator
    }

    if (
      previous.kind === segment.kind &&
      previous.spellId === segment.spellId &&
      previous.spellName === segment.spellName &&
      segment.startMs <= previous.endMs
    ) {
      previous.endMs = Math.max(previous.endMs, segment.endMs)
      return accumulator
    }

    accumulator.push({ ...segment })
    return accumulator
  }, [])
}

function resolveWinningState(
  activeStates: Map<string, ActiveThreatState>,
): ActiveThreatState | null {
  let winner: ActiveThreatState | null = null

  activeStates.forEach((state) => {
    if (!winner || state.sequence > winner.sequence) {
      winner = state
    }
  })

  return winner
}

function collectStateTransitionsByActor({
  sortedEvents,
  fightStartTime,
  firstTimestamp,
  fightEndMs,
  target,
  abilityById,
}: {
  sortedEvents: AugmentedEventsResponse['events']
  fightStartTime: number
  firstTimestamp: number
  fightEndMs: number
  target: FightTarget
  abilityById: Map<number, ReportAbilitySummary>
}): Map<number, ThreatStateTransition[]> {
  const transitionsByActor = new Map<number, ThreatStateTransition[]>()
  let sequence = 0

  sortedEvents.forEach((event) => {
    const timeMs = clampTimeMs(
      resolveRelativeTimeMs(event.timestamp, fightStartTime, firstTimestamp),
      fightEndMs,
    )
    ;(event.threat?.calculation.effects ?? []).forEach((effect) => {
      if (effect.type !== 'state') {
        return
      }

      if (!isThreatStateVisualKind(effect.state.kind)) {
        return
      }
      if (effect.state.phase !== 'start' && effect.state.phase !== 'end') {
        return
      }

      if (
        effect.state.kind === 'fixate' &&
        (effect.state.targetId !== target.id ||
          (effect.state.targetInstance ?? defaultTargetInstance) !==
            target.instance)
      ) {
        return
      }

      const transition: ThreatStateTransition = {
        actorId: effect.state.actorId,
        kind: effect.state.kind,
        phase: effect.state.phase,
        spellId: effect.state.spellId,
        spellName: resolveStateSpellName(effect.state.spellId, abilityById),
        timeMs,
        sequence,
      }
      sequence += 1

      const existing = transitionsByActor.get(transition.actorId) ?? []
      existing.push(transition)
      transitionsByActor.set(transition.actorId, existing)
    })
  })

  return transitionsByActor
}

function buildActorStateVisuals(
  transitions: ThreatStateTransition[],
  fightEndMs: number,
): ActorStateVisuals {
  if (transitions.length === 0) {
    return {
      stateVisualSegments: [],
      fixateWindows: [],
      invulnerabilityWindows: [],
    }
  }

  const sorted = [...transitions].sort(
    (a, b) => a.timeMs - b.timeMs || a.sequence - b.sequence,
  )
  const activeStates = new Map<string, ActiveThreatState>()
  const windowsByKind = {
    fixate: [] as ThreatStateWindow[],
    aggroLoss: [] as ThreatStateWindow[],
    invulnerable: [] as ThreatStateWindow[],
  }
  const stateVisualSegments: ThreatStateVisualSegment[] = []

  let currentWinner: ActiveThreatState | null = null
  let currentSegmentStart: number | null = null
  let index = 0

  const closeStateWindow = (state: ActiveThreatState, endMs: number): void => {
    if (endMs <= state.startMs) {
      return
    }

    windowsByKind[state.kind].push({
      startMs: state.startMs,
      endMs,
    })
  }

  while (index < sorted.length) {
    const timestamp = sorted[index]?.timeMs ?? 0
    if (
      currentWinner &&
      currentSegmentStart !== null &&
      timestamp > currentSegmentStart
    ) {
      stateVisualSegments.push({
        kind: currentWinner.kind,
        spellId: currentWinner.spellId,
        spellName: currentWinner.spellName ?? undefined,
        startMs: currentSegmentStart,
        endMs: timestamp,
      })
    }

    const timestampTransitions: ThreatStateTransition[] = []
    while ((sorted[index]?.timeMs ?? -1) === timestamp) {
      const transition = sorted[index]
      if (transition) {
        timestampTransitions.push(transition)
      }
      index += 1
    }

    timestampTransitions
      .filter((transition) => transition.phase === 'end')
      .forEach((transition) => {
        const key = `${transition.kind}:${transition.spellId}`
        const activeState = activeStates.get(key)
        if (!activeState) {
          return
        }

        closeStateWindow(activeState, transition.timeMs)
        activeStates.delete(key)
      })

    timestampTransitions
      .filter((transition) => transition.phase === 'start')
      .forEach((transition) => {
        const key = `${transition.kind}:${transition.spellId}`
        const existingState = activeStates.get(key)
        if (existingState) {
          closeStateWindow(existingState, transition.timeMs)
        }

        activeStates.set(key, {
          key,
          kind: transition.kind,
          spellId: transition.spellId,
          spellName: transition.spellName,
          startMs: transition.timeMs,
          sequence: transition.sequence,
        })
      })

    currentWinner = resolveWinningState(activeStates)
    currentSegmentStart = timestamp
  }

  if (
    currentWinner &&
    currentSegmentStart !== null &&
    fightEndMs > currentSegmentStart
  ) {
    stateVisualSegments.push({
      kind: currentWinner.kind,
      spellId: currentWinner.spellId,
      spellName: currentWinner.spellName ?? undefined,
      startMs: currentSegmentStart,
      endMs: fightEndMs,
    })
  }

  activeStates.forEach((state) => {
    closeStateWindow(state, fightEndMs)
  })

  return {
    stateVisualSegments: mergeStateVisualSegments(stateVisualSegments),
    fixateWindows: mergeStateWindows(windowsByKind.fixate),
    invulnerabilityWindows: mergeStateWindows(windowsByKind.invulnerable),
  }
}

/** Build selectable fight targets keyed by enemy id + instance id. */
export function buildFightTargetOptions({
  enemies,
  events,
}: {
  enemies: ReportActorSummary[]
  events: AugmentedEventsResponse['events']
}): FightTargetOption[] {
  const enemiesById = new Map(enemies.map((enemy) => [enemy.id, enemy]))
  const observedInstancesByEnemyId = new Map<number, Set<number>>()
  const targetMap = new Map<string, FightTargetOption>()

  const addObservedInstance = ({
    enemyId,
    instance,
  }: {
    enemyId: number
    instance: number
  }): void => {
    if (!enemiesById.has(enemyId)) {
      return
    }

    const existing = observedInstancesByEnemyId.get(enemyId)
    if (existing) {
      existing.add(instance)
      return
    }

    observedInstancesByEnemyId.set(enemyId, new Set([instance]))
  }

  const upsertTarget = (target: FightTarget): void => {
    const enemy = enemiesById.get(target.id)
    if (!enemy) {
      return
    }

    const key = buildTargetKey(target)
    if (targetMap.has(key)) {
      return
    }

    targetMap.set(key, {
      id: target.id,
      instance: target.instance,
      key,
      name: enemy.name,
      label: enemy.name,
      isBoss: enemy.subType === 'Boss',
    })
  }

  events.forEach((event) => {
    if (enemiesById.has(event.sourceID)) {
      addObservedInstance({
        enemyId: event.sourceID,
        instance: event.sourceInstance ?? defaultTargetInstance,
      })
    }

    if (enemiesById.has(event.targetID)) {
      addObservedInstance({
        enemyId: event.targetID,
        instance: event.targetInstance ?? defaultTargetInstance,
      })
    }

    ;(event.threat?.changes ?? []).forEach((change) => {
      addObservedInstance({
        enemyId: change.targetId,
        instance: change.targetInstance ?? defaultTargetInstance,
      })
    })
  })

  enemies.forEach((enemy) => {
    const observedInstances =
      observedInstancesByEnemyId.get(enemy.id) ??
      new Set([defaultTargetInstance])
    const displayId = enemy.id

    ;[...observedInstances]
      .sort((left, right) => left - right)
      .forEach((instance) => {
        upsertTarget({
          id: enemy.id,
          instance,
        })

        const key = buildTargetKey({
          id: enemy.id,
          instance,
        })
        const existing = targetMap.get(key)
        if (!existing) {
          return
        }

        existing.label = buildTargetLabel({
          name: enemy.name,
          displayId,
          instance,
          hasMultipleInstances: observedInstances.size > 1,
        })
      })
  })

  const targets = [...targetMap.values()]
  const bossTargets = targets
    .filter((target) => target.isBoss)
    .sort(compareTargetsByName)
  const nonBossTargets = targets
    .filter((target) => !target.isBoss)
    .sort(compareTargetsByName)

  return [...bossTargets, ...nonBossTargets]
}

/** Pick default target by highest accumulated threat in the fight. */
export function selectDefaultTarget(
  events: AugmentedEventsResponse['events'],
  validTargetKeys: Set<string>,
): FightTarget | null {
  if (validTargetKeys.size === 0) {
    return null
  }

  const sourceTargetState = new Map<string, number>()
  const targetTotals = new Map<string, number>()

  events.forEach((event) => {
    event.threat?.changes?.forEach((change) => {
      const target = {
        id: change.targetId,
        instance: change.targetInstance ?? defaultTargetInstance,
      }
      const targetKey = buildTargetKey(target)
      if (!validTargetKeys.has(targetKey)) {
        return
      }

      const sourceTargetKey = `${change.sourceId}:${targetKey}`
      const previous = sourceTargetState.get(sourceTargetKey) ?? 0
      const next = change.total
      sourceTargetState.set(sourceTargetKey, next)

      const runningTotal = targetTotals.get(targetKey) ?? 0
      targetTotals.set(targetKey, runningTotal + (next - previous))
    })
  })

  const sorted = [...targetTotals.entries()].sort((a, b) => b[1] - a[1])
  const fallbackTargetKey = [...validTargetKeys][0] ?? null
  const selectedTargetKey = sorted[0]?.[0] ?? fallbackTargetKey
  if (!selectedTargetKey) {
    return null
  }

  const [idRaw, instanceRaw] = selectedTargetKey.split(':')
  return {
    id: Number(idRaw),
    instance: Number(instanceRaw),
  }
}

/** Build chartable threat series for a target from augmented events. */
export function buildThreatSeries({
  events,
  actors,
  abilities,
  fightStartTime,
  fightEndTime,
  target,
}: {
  events: AugmentedEventsResponse['events']
  actors: ReportActorSummary[]
  abilities: ReportAbilitySummary[]
  fightStartTime: number
  fightEndTime: number
  target: FightTarget
}): ThreatSeries[] {
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]))
  const abilityById = createAbilityMap(abilities)
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const firstTimestamp = sortedEvents[0]?.timestamp ?? fightStartTime
  const lastTimestamp =
    sortedEvents[sortedEvents.length - 1]?.timestamp ?? fightEndTime
  const fightEndMs = Math.max(
    resolveRelativeTimeMs(fightEndTime, fightStartTime, firstTimestamp),
    resolveRelativeTimeMs(lastTimestamp, fightStartTime, firstTimestamp),
  )
  const stateTransitionsByActor = collectStateTransitionsByActor({
    sortedEvents,
    fightStartTime,
    firstTimestamp,
    fightEndMs,
    target,
    abilityById,
  })

  const accumulators = new Map<number, SeriesAccumulator>()

  actors
    .filter((actor) => trackableActorTypes.has(actor.type))
    .forEach((actor) => {
      accumulators.set(actor.id, {
        actorId: actor.id,
        actorName: actor.name,
        actorClass: resolveActorClass(actor, actorsById),
        actorType: actor.type as 'Player' | 'Pet',
        ownerId: actor.type === 'Pet' ? (actor.petOwner ?? null) : null,
        label: buildActorLabel(actor, actorsById),
        color: getActorColor(actor, actorsById),
        points: [],
        maxThreat: 0,
        totalThreat: 0,
        totalDamage: 0,
        totalHealing: 0,
        stateVisualSegments: [],
        fixateWindows: [],
        invulnerabilityWindows: [],
      })
    })

  sortedEvents.forEach((event) => {
    const abilityId = event.abilityGameID ?? null
    const spellId = abilityId ?? undefined
    const abilityName =
      abilityId !== null
        ? (abilityById.get(abilityId)?.name ?? `Ability #${abilityId}`)
        : event.type === 'death'
          ? 'Death'
          : 'Unknown ability'
    const spellSchool =
      event.type === 'damage' || event.type === 'heal'
        ? (() => {
            const abilitySchoolMask =
              abilityId !== null
                ? parseAbilitySchoolMask(
                    abilityById.get(abilityId)?.type ?? null,
                  )
                : 0
            const abilitySchoolLabels =
              resolveSchoolLabelsFromMask(abilitySchoolMask)
            return abilitySchoolLabels.length > 0
              ? abilitySchoolLabels.join('/')
              : null
          })()
        : null
    const formula = event.threat?.calculation.formula ?? 'n/a'
    const modifiers = normalizeThreatModifiers(
      event.threat?.calculation.modifiers,
    )
    const targetName = actorsById.get(event.targetID)?.name ?? null
    const isTick = event.tick === true
    const amount = event.threat?.calculation.amount ?? 0
    const baseThreat = event.threat?.calculation.baseThreat ?? 0
    const modifiedThreat = event.threat?.calculation.modifiedThreat ?? 0
    const resourceType = event.resourceChangeType ?? null
    const hitType =
      typeof event.hitType === 'number'
        ? event.hitType === 1
          ? undefined
          : event.hitType
        : event.hitType !== 'hit'
          ? event.hitType
          : undefined
    const timeMs = resolveRelativeTimeMs(
      event.timestamp,
      fightStartTime,
      firstTimestamp,
    )
    const damageDone =
      event.type === 'damage' ? Math.max(0, event.amount ?? 0) : 0
    const healingDone =
      event.type === 'heal' ? Math.max(0, event.amount ?? 0) : 0
    const eventMarkersByActorId = resolveEventPointMarkers({
      event,
      target,
      actorsById,
    })
    const invulnerabilityStartActorIds = resolveInvulnerabilityStartActorIds({
      event,
      actorsById,
    })
    const actorsWithEventPoint = new Set<number>()

    event.threat?.changes?.forEach((change) => {
      if (
        change.targetId !== target.id ||
        (change.targetInstance ?? defaultTargetInstance) !== target.instance
      ) {
        return
      }

      const accumulator = accumulators.get(change.sourceId)
      if (!accumulator) {
        return
      }

      accumulator.totalThreat = change.total
      accumulator.maxThreat = Math.max(accumulator.maxThreat, change.total)
      accumulator.totalDamage += damageDone
      accumulator.totalHealing += healingDone

      ensureEncounterStartPoint(accumulator, fightStartTime)

      accumulator.points.push({
        timestamp: event.timestamp,
        timeMs,
        totalThreat: change.total,
        threatDelta: change.amount,
        amount,
        baseThreat,
        modifiedThreat,
        ...(spellId ? { spellId } : {}),
        resourceType,
        spellSchool,
        eventType: event.type,
        abilityName,
        targetName,
        ...(hitType ? { hitType } : {}),
        isTick,
        formula,
        modifiers,
      })
      actorsWithEventPoint.add(change.sourceId)
    })

    eventMarkersByActorId.forEach((markerKind, actorId) => {
      const accumulator = accumulators.get(actorId)
      if (!accumulator) {
        return
      }

      if (actorsWithEventPoint.has(actorId)) {
        for (
          let index = accumulator.points.length - 1;
          index >= 0;
          index -= 1
        ) {
          const point = accumulator.points[index]
          if (!point || point.timestamp !== event.timestamp) {
            continue
          }

          point.markerKind = markerKind
          return
        }
      }

      ensureEncounterStartPoint(accumulator, fightStartTime)
      accumulator.points.push({
        timestamp: event.timestamp,
        timeMs,
        totalThreat: accumulator.totalThreat,
        threatDelta: 0,
        amount,
        baseThreat,
        modifiedThreat,
        ...(spellId ? { spellId } : {}),
        resourceType,
        spellSchool,
        eventType: event.type,
        abilityName,
        targetName,
        ...(hitType ? { hitType } : {}),
        isTick,
        formula,
        modifiers,
        markerKind,
      })
      actorsWithEventPoint.add(actorId)
    })

    invulnerabilityStartActorIds.forEach((actorId) => {
      if (actorsWithEventPoint.has(actorId)) {
        return
      }

      const accumulator = accumulators.get(actorId)
      if (!accumulator) {
        return
      }

      ensureEncounterStartPoint(accumulator, fightStartTime)
      accumulator.points.push({
        timestamp: event.timestamp,
        timeMs,
        totalThreat: accumulator.totalThreat,
        threatDelta: 0,
        amount,
        baseThreat,
        modifiedThreat,
        ...(spellId ? { spellId } : {}),
        resourceType,
        spellSchool,
        eventType: event.type,
        abilityName,
        targetName,
        ...(hitType ? { hitType } : {}),
        isTick,
        formula,
        modifiers,
      })
      actorsWithEventPoint.add(actorId)
    })
  })

  stateTransitionsByActor.forEach((transitions, actorId) => {
    const accumulator = accumulators.get(actorId)
    if (!accumulator) {
      return
    }

    const actorStateVisuals = buildActorStateVisuals(transitions, fightEndMs)
    accumulator.stateVisualSegments = actorStateVisuals.stateVisualSegments
    accumulator.fixateWindows = actorStateVisuals.fixateWindows
    accumulator.invulnerabilityWindows =
      actorStateVisuals.invulnerabilityWindows
  })

  return [...accumulators.values()]
    .filter((series) => series.points.length > 0)
    .sort((a, b) => b.maxThreat - a.maxThreat)
}

/** Filter visible chart series based on selected player IDs. */
export function filterSeriesByPlayers(
  allSeries: ThreatSeries[],
  selectedPlayerIds: number[],
): ThreatSeries[] {
  if (selectedPlayerIds.length === 0) {
    return allSeries
  }

  const selected = new Set(selectedPlayerIds)

  return allSeries.filter((series) => {
    if (series.actorType === 'Player') {
      return selected.has(series.actorId)
    }

    if (!series.ownerId) {
      return false
    }

    return selected.has(series.ownerId)
  })
}

/** Build summary rows for selected/focused players and pets. */
export function buildPlayerSummaryRows(
  series: ThreatSeries[],
  focusedActorIds: Set<number>,
): PlayerSummaryRow[] {
  return series
    .filter((item) => focusedActorIds.has(item.actorId))
    .map((item) => ({
      actorId: item.actorId,
      label: item.label,
      actorClass: item.actorClass,
      totalThreat: item.totalThreat,
      totalDamage: item.totalDamage,
      totalHealing: item.totalHealing,
      color: item.color,
    }))
    .sort((a, b) => b.totalThreat - a.totalThreat)
}

/** Resolve chart window bounds from all visible series points. */
export function resolveSeriesWindowBounds(series: ThreatSeries[]): {
  min: number
  max: number
} {
  const allPoints = series.flatMap((item) => item.points)
  if (allPoints.length === 0) {
    return { min: 0, max: 0 }
  }

  const times = allPoints.map((point) => point.timeMs)
  return {
    min: Math.min(...times),
    max: Math.max(...times),
  }
}

function resolveFocusedActorSourceIds(
  actors: ReportActorSummary[],
  focusedActorId: number,
): Set<number> {
  const focusedActor = actors.find((actor) => actor.id === focusedActorId)
  if (!focusedActor || !trackableActorTypes.has(focusedActor.type)) {
    return new Set()
  }

  return new Set([focusedActor.id])
}

function resolveAbilityName(
  abilityId: number | null,
  abilityById: Map<number, ReportAbilitySummary>,
): string {
  if (abilityId === null) {
    return 'Unknown ability'
  }

  return abilityById.get(abilityId)?.name ?? `Ability #${abilityId}`
}

function resolveFocusedThreatRowSpellSchool(
  abilityId: number | null,
  abilityById: Map<number, ReportAbilitySummary>,
): string | null {
  if (abilityId === null) {
    return null
  }

  const abilitySchoolMask = parseAbilitySchoolMask(
    abilityById.get(abilityId)?.type ?? null,
  )
  if (abilitySchoolMask <= 0) {
    return null
  }

  const labels = resolveSchoolLabelsFromMask(abilitySchoolMask)
  if (labels.length === 0) {
    return null
  }

  return labels.join('/')
}

function resolveFocusedThreatEventSuffix(eventType: string): string | null {
  if (eventType === 'resourcechange') {
    return 'resourcechange'
  }

  if (eventType === 'energize') {
    return 'energize'
  }

  return null
}

/** Build totals/class metadata for the currently focused player. */
export function buildFocusedPlayerSummary({
  events,
  actors,
  fightStartTime,
  target,
  focusedPlayerId,
  windowStartMs,
  windowEndMs,
}: {
  events: AugmentedEventsResponse['events']
  actors: ReportActorSummary[]
  abilities?: ReportAbilitySummary[]
  threatConfig?: ThreatConfig | null
  fightStartTime: number
  target: FightTarget
  focusedPlayerId: number | null
  windowStartMs: number
  windowEndMs: number
}): FocusedPlayerSummary | null {
  if (focusedPlayerId === null) {
    return null
  }

  const actorsById = new Map(actors.map((actor) => [actor.id, actor]))
  const focusedPlayer = actorsById.get(focusedPlayerId)
  if (!focusedPlayer || !trackableActorTypes.has(focusedPlayer.type)) {
    return null
  }

  const sourceIds = resolveFocusedActorSourceIds(actors, focusedPlayerId)
  if (sourceIds.size === 0) {
    return null
  }

  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const firstTimestamp = sortedEvents[0]?.timestamp ?? fightStartTime
  const windowDurationSeconds = Math.max(1, windowEndMs - windowStartMs) / 1000
  const actorClass = resolveActorClass(focusedPlayer, actorsById)
  const modifiers = buildAppliedModifiersForFocusedActor({
    events: sortedEvents,
    sourceIds,
  })

  const totals = sortedEvents.reduce(
    (acc, event) => {
      const timeMs = resolveRelativeTimeMs(
        event.timestamp,
        fightStartTime,
        firstTimestamp,
      )
      if (timeMs < windowStartMs || timeMs > windowEndMs) {
        return acc
      }

      const hasMatchingChange = (event.threat?.changes ?? []).some(
        (change) =>
          change.targetId === target.id &&
          (change.targetInstance ?? defaultTargetInstance) ===
            target.instance &&
          sourceIds.has(change.sourceId),
      )
      if (!hasMatchingChange) {
        return acc
      }

      const threatDelta = (event.threat?.changes ?? [])
        .filter(
          (change) =>
            change.targetId === target.id &&
            (change.targetInstance ?? defaultTargetInstance) ===
              target.instance &&
            sourceIds.has(change.sourceId),
        )
        .reduce((sum, change) => sum + change.amount, 0)

      return {
        totalThreat: acc.totalThreat + threatDelta,
        totalDamage:
          acc.totalDamage +
          (event.type === 'damage' ? Math.max(0, event.amount ?? 0) : 0),
        totalHealing:
          acc.totalHealing +
          (event.type === 'heal' ? Math.max(0, event.amount ?? 0) : 0),
      }
    },
    {
      totalThreat: 0,
      totalDamage: 0,
      totalHealing: 0,
    },
  )

  // Extract talent points from combatant info
  const talentPoints =
    focusedPlayer.type === 'Player'
      ? extractTalentPoints(events, focusedPlayerId)
      : undefined

  return {
    actorId: focusedPlayerId,
    label: buildActorLabel(focusedPlayer, actorsById),
    actorClass,
    talentPoints,
    totalThreat: totals.totalThreat,
    totalTps: totals.totalThreat / windowDurationSeconds,
    totalDamage: totals.totalDamage,
    totalHealing: totals.totalHealing,
    color: getActorColor(focusedPlayer, actorsById),
    modifiers,
  }
}

/** Extract talent points array from combatant info event */
function extractTalentPoints(
  events: AugmentedEvent[],
  actorId: number,
): [number, number, number] | undefined {
  const combatantInfoEvent = events.find(
    (event) => event.type === 'combatantinfo' && event.sourceID === actorId,
  )

  if (!combatantInfoEvent) {
    return
  }

  // WCL API returns talents as an array of {id: number, icon: string}
  // where id is the number of talent points in each tree
  const talents = combatantInfoEvent.talents

  if (!talents || talents.length !== 3) {
    return
  }

  return [talents[0].id, talents[1].id, talents[2].id]
}

function isFixateThreatEvent({
  event,
  target,
  sourceIds,
}: {
  event: AugmentedEventsResponse['events'][number]
  target: FightTarget
  sourceIds: Set<number>
}): boolean {
  return (event.threat?.calculation.effects ?? []).some((effect) => {
    if (effect.type !== 'state' || effect.state.kind !== 'fixate') {
      return false
    }

    return (
      effect.state.targetId === target.id &&
      (effect.state.targetInstance ?? defaultTargetInstance) ===
        target.instance &&
      sourceIds.has(effect.state.actorId)
    )
  })
}

/** Build per-ability threat breakdown rows for a focused player in the selected chart window. */
export function buildFocusedPlayerThreatRows({
  events,
  actors,
  abilities,
  fightStartTime,
  target,
  focusedPlayerId,
  windowStartMs,
  windowEndMs,
}: {
  events: AugmentedEventsResponse['events']
  actors: ReportActorSummary[]
  abilities: ReportAbilitySummary[]
  fightStartTime: number
  target: FightTarget
  focusedPlayerId: number | null
  windowStartMs: number
  windowEndMs: number
}): FocusedPlayerThreatRow[] {
  if (focusedPlayerId === null) {
    return []
  }

  const actorsById = new Map(actors.map((actor) => [actor.id, actor]))
  const focusedPlayer = actorsById.get(focusedPlayerId)
  if (!focusedPlayer || !trackableActorTypes.has(focusedPlayer.type)) {
    return []
  }

  const sourceIds = resolveFocusedActorSourceIds(actors, focusedPlayerId)
  if (sourceIds.size === 0) {
    return []
  }

  const abilityById = createAbilityMap(abilities)
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const firstTimestamp = sortedEvents[0]?.timestamp ?? fightStartTime
  const windowDurationSeconds = Math.max(1, windowEndMs - windowStartMs) / 1000
  const rowsByAbility = new Map<string, FocusedPlayerThreatRow>()
  const modifierVariantsByRowKey = new Map<
    string,
    Map<string, ModifierVariantAccumulator>
  >()

  sortedEvents.forEach((event) => {
    const timeMs = resolveRelativeTimeMs(
      event.timestamp,
      fightStartTime,
      firstTimestamp,
    )
    if (timeMs < windowStartMs || timeMs > windowEndMs) {
      return
    }

    const matchingThreat = (event.threat?.changes ?? [])
      .filter(
        (change) =>
          change.targetId === target.id &&
          (change.targetInstance ?? defaultTargetInstance) ===
            target.instance &&
          sourceIds.has(change.sourceId),
      )
      .reduce((sum, change) => sum + change.amount, 0)
    if (matchingThreat === 0) {
      return
    }

    const eventType = event.type.toLowerCase()
    const abilityId = event.abilityGameID ?? null
    const abilityName = resolveAbilityName(abilityId, abilityById)
    const eventSuffix = resolveFocusedThreatEventSuffix(eventType)
    const rowAbilityName = eventSuffix
      ? `${abilityName} (${eventSuffix})`
      : abilityName
    const keyBase =
      abilityId === null ? `unknown:${abilityName}` : String(abilityId)
    const key = eventSuffix ? `${keyBase}:${eventType}` : keyBase
    const spellSchool = resolveFocusedThreatRowSpellSchool(
      abilityId,
      abilityById,
    )
    const damageHealingAmount =
      event.type === 'damage' || event.type === 'heal'
        ? Math.max(0, event.amount ?? 0)
        : 0
    const isHealEvent = event.type === 'heal'
    const isFixateEvent = isFixateThreatEvent({
      event,
      target,
      sourceIds,
    })
    const visibleModifiers = normalizeThreatModifiers(
      event.threat?.calculation.modifiers,
    ).filter((modifier) => isVisibleModifierValue(modifier.value))
    if (visibleModifiers.length > 0) {
      const variantKey = createModifierVariantKey(visibleModifiers)
      const rowVariants = modifierVariantsByRowKey.get(key) ?? new Map()
      const existingVariant = rowVariants.get(variantKey)
      if (existingVariant) {
        existingVariant.totalThreat += Math.abs(matchingThreat)
      } else {
        rowVariants.set(variantKey, {
          modifiers: visibleModifiers,
          totalThreat: Math.abs(matchingThreat),
        })
      }
      modifierVariantsByRowKey.set(key, rowVariants)
    }

    const existing = rowsByAbility.get(key)
    if (existing) {
      existing.amount += damageHealingAmount
      existing.threat += matchingThreat
      existing.isHeal = existing.isHeal || isHealEvent
      existing.isFixate = existing.isFixate || isFixateEvent
      return
    }

    rowsByAbility.set(key, {
      key,
      abilityId,
      abilityName: rowAbilityName,
      amount: damageHealingAmount,
      threat: matchingThreat,
      tps: 0,
      isHeal: isHealEvent,
      isFixate: isFixateEvent,
      ...(spellSchool ? { spellSchool } : {}),
      modifierTotal: 1,
      modifierBreakdown: [],
    })
  })

  return [...rowsByAbility.values()]
    .map((row) => {
      const dominantVariant = [
        ...(modifierVariantsByRowKey.get(row.key)?.values() ?? []),
      ].sort((left, right) => right.totalThreat - left.totalThreat)[0]
      const modifierBreakdown = dominantVariant?.modifiers ?? []
      const modifierTotal = modifierBreakdown.reduce((total, modifier) => {
        if (!isVisibleModifierValue(modifier.value)) {
          return total
        }

        return total * modifier.value
      }, 1)

      return {
        ...row,
        tps: row.isFixate ? null : row.threat / windowDurationSeconds,
        modifierTotal,
        modifierBreakdown,
      }
    })
    .sort((a, b) => {
      const byThreat = Math.abs(b.threat) - Math.abs(a.threat)
      if (byThreat !== 0) {
        return byThreat
      }

      const byAmount = b.amount - a.amount
      if (byAmount !== 0) {
        return byAmount
      }

      return a.abilityName.localeCompare(b.abilityName)
    })
}

function resolveRankingOwnerId(actor: ReportActorSummary): number | null {
  if (actor.type === 'Player') {
    return actor.id
  }

  if (actor.type === 'Pet' && actor.petOwner) {
    return actor.petOwner
  }

  return null
}

/** Build report-level ranking rows aggregated across all fights. */
export function buildReportRankings({
  fights,
  actors,
}: {
  fights: Array<{ fightId: number; events: AugmentedEventsResponse['events'] }>
  actors: ReportActorSummary[]
}): ReportPlayerRanking[] {
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]))
  const ranking = new Map<number, ReportPlayerRanking>()

  fights.forEach(({ fightId, events }) => {
    const fightTotals = new Map<number, number>()

    events.forEach((event) => {
      event.threat?.changes?.forEach((change) => {
        const source = actorsById.get(change.sourceId)
        if (!source) {
          return
        }

        const ownerId = resolveRankingOwnerId(source)
        if (!ownerId) {
          return
        }

        const current = fightTotals.get(ownerId) ?? 0
        fightTotals.set(ownerId, current + change.amount)
      })
    })

    fightTotals.forEach((fightThreat, ownerId) => {
      const owner = actorsById.get(ownerId)
      if (!owner || owner.type !== 'Player') {
        return
      }

      const existing = ranking.get(ownerId)
      const ownerClass = (owner.subType as PlayerClass | undefined) ?? null
      const color = getClassColor(ownerClass)

      if (existing) {
        existing.totalThreat += fightThreat
        existing.perFight[fightId] = fightThreat
        existing.fightCount = Object.keys(existing.perFight).length
        return
      }

      ranking.set(ownerId, {
        actorId: ownerId,
        actorName: owner.name,
        actorClass: ownerClass,
        color,
        totalThreat: fightThreat,
        fightCount: 1,
        perFight: {
          [fightId]: fightThreat,
        },
      })
    })
  })

  return [...ranking.values()].sort((a, b) => b.totalThreat - a.totalThreat)
}

/** Extract all notable aura spell IDs from threat config (global and class-specific). */
export function getNotableAuraIds(config: {
  auraModifiers?: Record<SpellId, unknown>
  classes?: Record<
    string,
    {
      auraModifiers?: Record<SpellId, unknown>
    }
  >
}): Set<SpellId> {
  const auraIds = new Set<SpellId>()

  // Add global aura modifiers
  if (config.auraModifiers) {
    Object.keys(config.auraModifiers).forEach((id) => {
      auraIds.add(Number(id))
    })
  }

  // Add class-specific aura modifiers
  if (config.classes) {
    Object.values(config.classes).forEach((classConfig) => {
      if (classConfig.auraModifiers) {
        Object.keys(classConfig.auraModifiers).forEach((id) => {
          auraIds.add(Number(id))
        })
      }
    })
  }

  return auraIds
}

/** Find combatant info event for given actor and return its auras. */
export function getInitialAuras(
  events: AugmentedEventsResponse['events'],
  actorId: number,
): CombatantInfoAura[] {
  const combatantInfoEvent = events.find(
    (event) => event.type === 'combatantinfo' && event.sourceID === actorId,
  )

  if (!combatantInfoEvent || combatantInfoEvent.type !== 'combatantinfo') {
    return []
  }

  const auras =
    (
      combatantInfoEvent as {
        auras?: CombatantInfoAura[]
      }
    ).auras ?? []

  return auras.filter((aura) => getAuraSpellId(aura) !== null)
}

/** Build initial aura display rows with notable auras sorted to the top. */
export function buildInitialAurasDisplay(
  events: AugmentedEvent[],
  focusedPlayerId: number | null,
  threatConfig: {
    auraModifiers?: Record<SpellId, unknown>
    classes?: Record<
      string,
      {
        auraModifiers?: Record<SpellId, unknown>
      }
    >
  } | null,
  options?: {
    initialAurasByActor?: Record<string, number[]>
    abilities?: ReportAbilitySummary[]
  },
): InitialAuraDisplay[] {
  if (focusedPlayerId === null) {
    return []
  }

  const abilityNameById = buildAbilityNameMap(options?.abilities)
  const notableAuraIds = threatConfig
    ? getNotableAuraIds(threatConfig)
    : new Set<SpellId>()
  const initialAuras = getInitialAuras(events, focusedPlayerId)
  const aurasBySpellId = initialAuras.reduce((result, aura) => {
    const spellId = getAuraSpellId(aura)
    if (spellId === null) {
      return result
    }

    const fallbackName = `Spell ${spellId}`
    result.set(spellId, {
      isNotable: notableAuraIds.has(spellId),
      name: aura.name?.trim() ? aura.name : fallbackName,
      spellId,
      stacks: aura.stacks > 0 ? aura.stacks : 1,
    })

    return result
  }, new Map<number, InitialAuraDisplay>())
  const seededSpellIds =
    options?.initialAurasByActor?.[String(focusedPlayerId)] ?? []
  seededSpellIds.forEach((spellId) => {
    if (aurasBySpellId.has(spellId)) {
      return
    }

    const abilityName = abilityNameById.get(spellId)
    aurasBySpellId.set(spellId, {
      isNotable: notableAuraIds.has(spellId),
      name: abilityName ?? `Spell ${spellId}`,
      spellId,
      stacks: 1,
    })
  })

  return [...aurasBySpellId.values()].sort(
    (left, right) => Number(right.isNotable) - Number(left.isNotable),
  )
}
