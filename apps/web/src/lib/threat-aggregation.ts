/**
 * Threat data transformation helpers for report rankings and fight chart series.
 */
import type { AugmentedEvent, SpellId } from '@wcl-threat/shared'
import type { CombatantInfoAura, PlayerClass } from '@wcl-threat/wcl-types'

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
  timeMs: number
  sequence: number
}

interface ActiveThreatState {
  key: string
  kind: ThreatStateVisualKind
  startMs: number
  sequence: number
}

interface ActorStateVisuals {
  stateVisualSegments: ThreatStateVisualSegment[]
  fixateWindows: ThreatStateWindow[]
  invulnerabilityWindows: ThreatStateWindow[]
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

    if (previous.kind === segment.kind && segment.startMs <= previous.endMs) {
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
}: {
  sortedEvents: AugmentedEventsResponse['events']
  fightStartTime: number
  firstTimestamp: number
  fightEndMs: number
  target: FightTarget
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

  return [...targetMap.values()]
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
    const abilityName =
      abilityId !== null
        ? (abilityById.get(abilityId)?.name ?? `Ability #${abilityId}`)
        : event.type === 'death'
          ? 'Death'
          : 'Unknown ability'
    const abilitySchoolMask =
      abilityId !== null
        ? parseAbilitySchoolMask(abilityById.get(abilityId)?.type ?? null)
        : 0
    const abilitySchoolLabels = resolveSchoolLabelsFromMask(abilitySchoolMask)
    const spellSchool =
      abilitySchoolLabels.length > 0 ? abilitySchoolLabels.join('/') : null
    const formula = event.threat?.calculation.formula ?? 'n/a'
    const modifiers = normalizeThreatModifiers(
      event.threat?.calculation.modifiers,
    )
    const amount = event.threat?.calculation.amount ?? 0
    const baseThreat = event.threat?.calculation.baseThreat ?? 0
    const modifiedThreat = event.threat?.calculation.modifiedThreat ?? 0
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
        spellSchool,
        eventType: event.type,
        abilityName,
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
        spellSchool,
        eventType: event.type,
        abilityName,
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
        spellSchool,
        eventType: event.type,
        abilityName,
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

function resolveFocusedPlayerSourceIds(
  actors: ReportActorSummary[],
  focusedPlayerId: number,
): Set<number> {
  return new Set(
    actors
      .filter(
        (actor) =>
          actor.id === focusedPlayerId ||
          (actor.type === 'Pet' && actor.petOwner === focusedPlayerId),
      )
      .map((actor) => actor.id),
  )
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
  if (!focusedPlayer || focusedPlayer.type !== 'Player') {
    return null
  }

  const sourceIds = resolveFocusedPlayerSourceIds(actors, focusedPlayerId)
  if (sourceIds.size === 0) {
    return null
  }

  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const firstTimestamp = sortedEvents[0]?.timestamp ?? fightStartTime
  const windowDurationSeconds = Math.max(1, windowEndMs - windowStartMs) / 1000

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
  const talentPoints = extractTalentPoints(events, focusedPlayerId)

  return {
    actorId: focusedPlayerId,
    label: focusedPlayer.name,
    actorClass: (focusedPlayer.subType as PlayerClass | undefined) ?? null,
    talentPoints,
    totalThreat: totals.totalThreat,
    totalTps: totals.totalThreat / windowDurationSeconds,
    totalDamage: totals.totalDamage,
    totalHealing: totals.totalHealing,
    color: getActorColor(focusedPlayer, actorsById),
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
  if (!focusedPlayer || focusedPlayer.type !== 'Player') {
    return []
  }

  const sourceIds = resolveFocusedPlayerSourceIds(actors, focusedPlayerId)
  if (sourceIds.size === 0) {
    return []
  }

  const abilityById = createAbilityMap(abilities)
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const firstTimestamp = sortedEvents[0]?.timestamp ?? fightStartTime
  const windowDurationSeconds = Math.max(1, windowEndMs - windowStartMs) / 1000
  const rowsByAbility = new Map<string, FocusedPlayerThreatRow>()

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

    const abilityId = event.abilityGameID ?? null
    const abilityName = resolveAbilityName(abilityId, abilityById)
    const key =
      abilityId === null ? `unknown:${abilityName}` : String(abilityId)
    const damageHealingAmount =
      event.type === 'damage' || event.type === 'heal'
        ? Math.max(0, event.amount ?? 0)
        : 0

    const existing = rowsByAbility.get(key)
    if (existing) {
      existing.amount += damageHealingAmount
      existing.threat += matchingThreat
      return
    }

    rowsByAbility.set(key, {
      key,
      abilityId,
      abilityName,
      amount: damageHealingAmount,
      threat: matchingThreat,
      tps: 0,
    })
  })

  return [...rowsByAbility.values()]
    .map((row) => ({
      ...row,
      tps: row.threat / windowDurationSeconds,
    }))
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
): InitialAuraDisplay[] {
  if (focusedPlayerId === null) {
    return []
  }

  const notableAuraIds = threatConfig
    ? getNotableAuraIds(threatConfig)
    : new Set<SpellId>()
  const initialAuras = getInitialAuras(events, focusedPlayerId)

  return initialAuras
    .map((aura) => {
      const spellId = getAuraSpellId(aura)
      if (spellId === null) {
        return null
      }

      const fallbackName = `Spell ${spellId}`

      return {
        spellId,
        name: aura.name?.trim() ? aura.name : fallbackName,
        stacks: aura.stacks > 0 ? aura.stacks : 1,
        isNotable: notableAuraIds.has(spellId),
      }
    })
    .filter((aura): aura is InitialAuraDisplay => aura !== null)
    .sort((left, right) => Number(right.isNotable) - Number(left.isNotable))
}
