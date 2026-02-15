/**
 * Fight-level state management
 *
 * Orchestrates per-actor state tracking throughout a fight. Routes events to
 * actor instance state objects and coordinates cross-actor concerns
 * (e.g. talent/gear implications and threat-table mutations).
 */
import type {
  Actor,
  RuntimeActorView,
  ThreatConfig,
  WowClass,
} from '@wcl-threat/shared'
import type { GearItem, WCLEvent } from '@wcl-threat/wcl-types'

import { ActorState, positionUpdateActorByEventType } from './actor-state'
import type {
  ActorId,
  ActorKey,
  ActorReference,
  EnemyReference,
} from './instance-refs'
import {
  buildActorKey,
  normalizeInstanceId,
  parseActorKey,
  toActorInstanceReference,
} from './instance-refs'
import type { EnemyThreatEntry } from './threat-tracker'

const TALENT_ID_KEYS = [
  'spellID',
  'spellId',
  'abilityGameID',
  'abilityId',
  'gameID',
  'gameId',
  'guid',
  'id',
  'talentID',
  'talentId',
] as const

const TALENT_RANK_KEYS = [
  'rank',
  'points',
  'point',
  'pointsSpent',
  'pointSpent',
  'value',
] as const

const TALENT_TREE_SPLIT_KEYS = ['id', 'points', 'value'] as const
const COMBATANT_AURA_ID_KEYS = [
  'abilityGameID',
  'ability',
  'abilityID',
  'abilityId',
] as const

type UnknownRecord = Record<string, unknown>
const MAX_TALENT_PARSE_DEPTH = 6
const DEFAULT_INSTANCE_ID = 0

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null
    ? (value as UnknownRecord)
    : null
}

function readNumber(
  record: UnknownRecord,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return null
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item))
  )
}

function isValidTalentPointSplit(points: number[]): boolean {
  return (
    points.length === 3 && points.every((point) => point >= 0 && point <= 61)
  )
}

function parseLegacyTalentPointSplit(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== 3) {
    return []
  }

  const parsed = value.map((entry) => {
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      return Math.trunc(entry)
    }

    const record = asRecord(entry)
    if (!record) {
      return null
    }

    // Legacy payloads encode talent tree point splits as [{ id: 14 }, { id: 5 }, { id: 31 }]
    // and do not include per-talent ranks.
    if (readNumber(record, TALENT_RANK_KEYS) !== null) {
      return null
    }

    const treePoints = readNumber(record, TALENT_TREE_SPLIT_KEYS)
    return treePoints === null ? null : Math.trunc(treePoints)
  })

  if (parsed.some((value) => value === null)) {
    return []
  }

  const points = parsed as number[]
  return isValidTalentPointSplit(points) ? points : []
}

function parseCombatantInfoAuraId(aura: unknown): number | null {
  const record = asRecord(aura)
  if (!record) {
    return null
  }

  return readNumber(record, COMBATANT_AURA_ID_KEYS)
}

/**
 * Parse talent points from various formats in combatantinfo event
 */
function parseTalentPoints(
  event: Extract<WCLEvent, { type: 'combatantinfo' }>,
): number[] {
  if (isFiniteNumberArray(event.talentRows)) {
    return event.talentRows
  }

  // WCL API returns talents as array of {id: number, icon: string}
  // where id is the talent points in each tree
  if (
    event.talents &&
    Array.isArray(event.talents) &&
    event.talents.length > 0
  ) {
    // Check if it's the new WCL API format with objects containing id field
    if (
      typeof event.talents[0] === 'object' &&
      event.talents[0] !== null &&
      'id' in event.talents[0]
    ) {
      return event.talents.map((t) => t.id)
    }
  }

  // Try legacy talent point split format (object or number arrays)
  const legacyTalentPointSplit = parseLegacyTalentPointSplit(event.talents)
  if (legacyTalentPointSplit.length > 0) {
    return legacyTalentPointSplit
  }

  return []
}

function parseTalentRanks(
  event: Extract<WCLEvent, { type: 'combatantinfo' }>,
): Map<number, number> {
  const talentRanks = new Map<number, number>()

  function collectTalentRanks(value: unknown, depth: number): void {
    if (
      value === null ||
      value === undefined ||
      depth > MAX_TALENT_PARSE_DEPTH
    ) {
      return
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        collectTalentRanks(item, depth + 1)
      }
      return
    }

    const record = asRecord(value)
    if (!record) {
      return
    }

    const talentId = readNumber(record, TALENT_ID_KEYS)
    const rank = readNumber(record, TALENT_RANK_KEYS)
    if (talentId !== null && rank !== null && rank > 0) {
      const currentRank = talentRanks.get(talentId) ?? 0
      if (rank > currentRank) {
        talentRanks.set(talentId, rank)
      }
    }

    for (const nested of Object.values(record)) {
      collectTalentRanks(nested, depth + 1)
    }
  }

  collectTalentRanks(event.talents, 0)
  collectTalentRanks(event.talentTree, 0)

  return talentRanks
}

function dedupeIds(ids: number[]): number[] {
  if (ids.length <= 1) {
    return ids
  }

  return [...new Set(ids)]
}

function getSpecId(
  event: Extract<WCLEvent, { type: 'combatantinfo' }>,
): number | null {
  return event.specId ?? event.specID ?? null
}

/** Parse WCL combatant talent payloads into normalized tree points and optional rank map. */
function buildTalentContext(
  event: Extract<WCLEvent, { type: 'combatantinfo' }>,
): {
  talentPoints: number[]
  talentRanks: Map<number, number>
  specId: number | null
} {
  return {
    talentPoints: parseTalentPoints(event),
    talentRanks: parseTalentRanks(event),
    specId: getSpecId(event),
  }
}

function mergeSyntheticAuras(parts: Array<number[] | undefined>): number[] {
  const merged: number[] = []
  for (const part of parts) {
    if (!part || part.length === 0) {
      continue
    }
    merged.push(...part)
  }

  if (merged.length === 0) {
    return []
  }

  return dedupeIds(merged)
}

/** Top-level state container for a fight */
export class FightState {
  private actorStates = new Map<ActorKey, ActorState>()
  private actorProfiles: Map<ActorId, Actor>
  private allExclusiveAuras: Set<number>[]

  constructor(actorMap: Map<ActorId, Actor>, config: ThreatConfig) {
    this.actorProfiles = actorMap
    // Consolidate all exclusive aura sets from all class configs
    this.allExclusiveAuras = this.collectAllExclusiveAuras(config)
  }

  /** Collect all exclusive aura sets from all class configs */
  private collectAllExclusiveAuras(config: ThreatConfig): Set<number>[] {
    const allSets: Set<number>[] = []
    for (const classConfig of Object.values(config.classes)) {
      if (classConfig?.exclusiveAuras) {
        allSets.push(...classConfig.exclusiveAuras)
      }
    }
    return allSets
  }

  private getCompatActorReference(actorId: ActorId): ActorReference {
    return {
      id: actorId,
      instanceId: DEFAULT_INSTANCE_ID,
    }
  }

  private getActorProfile(actorId: ActorId): Actor {
    return (
      this.actorProfiles.get(actorId) ?? {
        id: actorId,
        name: `Unknown#${actorId}`,
        class: null,
      }
    )
  }

  /** Get or create an ActorState for the given actor reference */
  private getOrCreateActorState(actor: ActorReference): ActorState {
    const normalizedActor = toActorInstanceReference(actor)
    const actorKey = buildActorKey(normalizedActor)

    let state = this.actorStates.get(actorKey)
    if (!state) {
      state = new ActorState({
        profile: this.getActorProfile(normalizedActor.id),
        instanceId: normalizedActor.instanceId,
        exclusiveAuras: this.allExclusiveAuras,
      })
      this.actorStates.set(actorKey, state)
    }
    return state
  }

  /** Get ActorState for an explicit actor reference, if tracked. */
  private getActorStateByReference(
    actor: ActorReference,
  ): ActorState | undefined {
    const normalizedActor = toActorInstanceReference(actor)
    const actorKey = buildActorKey(normalizedActor)
    return this.actorStates.get(actorKey)
  }

  private getThreatSourceKey(actorId: ActorId): ActorKey {
    return buildActorKey(this.getCompatActorReference(actorId))
  }

  /** Process a WCL event and update relevant actor state */
  processEvent(event: WCLEvent, config: ThreatConfig): void {
    const sourceRef = {
      id: event.sourceID,
      instanceId: normalizeInstanceId(event.sourceInstance),
    }
    const sourceState = this.getOrCreateActorState(sourceRef)

    const targetRef = {
      id: event.targetID,
      instanceId: normalizeInstanceId(event.targetInstance),
    }
    const targetState =
      event.targetID === -1 ? undefined : this.getOrCreateActorState(targetRef)

    const positionRole = positionUpdateActorByEventType.get(event.type)
    if (positionRole === 'source') {
      sourceState.updatePosition(event)
    } else if (positionRole === 'target') {
      targetState?.updatePosition(event)
    }

    switch (event.type) {
      case 'combatantinfo':
        this.processCombatantInfo(event, config, sourceState)
        break
      case 'cast':
      case 'begincast':
        // Cast activity marks actors as alive and updates target selection.
        sourceState.markAlive()

        if (event.targetID !== -1) {
          sourceState.setTarget({
            targetId: event.targetID,
            targetInstance: normalizeInstanceId(event.targetInstance),
          })
        }

        if (event.type === 'cast') {
          this.processCastAuraImplications(event, config, sourceState)
        }
        break
      case 'damage':
        if (event.overkill > 0) {
          targetState?.markDead()
        }
        break
      case 'applybuff':
      case 'refreshbuff':
      case 'applybuffstack':
      case 'applydebuff':
      case 'refreshdebuff':
      case 'applydebuffstack':
        targetState?.auraTracker.addAura(event.abilityGameID)
        break
      case 'removebuff':
      case 'removedebuff':
        targetState?.auraTracker.removeAura(event.abilityGameID)
        break
      case 'removebuffstack':
      case 'removedebuffstack':
        if (event.stacks !== undefined && event.stacks <= 0) {
          targetState?.auraTracker.removeAura(event.abilityGameID)
        }
        break
      case 'death':
        targetState?.markDead()
        break
      case 'resurrect':
        targetState?.markAlive()
        break
    }
  }

  /** Process cast-driven aura implications (e.g., form inferred by cast spell). */
  private processCastAuraImplications(
    event: Extract<WCLEvent, { type: 'cast' }>,
    config: ThreatConfig,
    sourceState: ActorState,
  ): void {
    const wowClass = sourceState.actorClass as WowClass | null
    const classConfig = wowClass ? config.classes[wowClass] : undefined
    const auraImplications = classConfig?.auraImplications

    if (!auraImplications || auraImplications.size === 0) {
      return
    }

    const impliedAuras = [...auraImplications.entries()]
      .filter(([, spellIds]) => spellIds.has(event.abilityGameID))
      .map(([auraId]) => auraId)

    if (impliedAuras.length > 0) {
      sourceState.auraTracker.seedAuras(dedupeIds(impliedAuras))
    }
  }

  /** Get the composite state for an actor at instance 0 (compatibility accessor). */
  getActorState(actorId: ActorId): ActorState | undefined {
    return this.getActorStateByReference(this.getCompatActorReference(actorId))
  }

  /** Get a read-only runtime actor snapshot for a specific instance. */
  getActor(actor: ActorReference): RuntimeActorView | null {
    const normalizedActor = toActorInstanceReference(actor)
    const state = this.getActorStateByReference(normalizedActor)

    if (state) {
      return state.getRuntimeView()
    }

    const profile = this.actorProfiles.get(normalizedActor.id)
    if (!profile) {
      return null
    }

    return {
      id: normalizedActor.id,
      instanceId: normalizedActor.instanceId,
      name: profile.name,
      class: profile.class,
      alive: true,
      position: null,
      currentTarget: null,
      lastTarget: null,
      auras: new Set(),
    }
  }

  /** Get active auras for an actor instance. */
  getAurasForActor(actor: ActorReference): ReadonlySet<number> {
    return new Set(this.getActorStateByReference(actor)?.auras ?? [])
  }

  /** Get active auras for an actor at instance 0 (compatibility method). */
  getAuras(actorId: ActorId): Set<number> {
    return new Set(this.getActorState(actorId)?.auras ?? [])
  }

  /** Ensure an aura is active on an actor at instance 0. */
  setAura(actorId: ActorId, spellId: number): void {
    this.getOrCreateActorState(
      this.getCompatActorReference(actorId),
    ).auraTracker.addAura(spellId)
  }

  /** Remove an aura from an actor at instance 0. */
  removeAura(actorId: ActorId, spellId: number): void {
    this.getOrCreateActorState(
      this.getCompatActorReference(actorId),
    ).auraTracker.removeAura(spellId)
  }

  /** Get equipped gear for an actor at instance 0 (compatibility method). */
  getGear(actorId: ActorId): GearItem[] {
    return [...(this.getActorState(actorId)?.gear ?? [])]
  }

  /**
   * Process a combatantinfo event:
   * seed auras, store gear, and infer synthetic auras from implication hooks.
   */
  private processCombatantInfo(
    event: Extract<WCLEvent, { type: 'combatantinfo' }>,
    config: ThreatConfig,
    actorState: ActorState,
  ): void {
    // Seed initial auras from combatant info
    if (event.auras) {
      const auraIds = dedupeIds(
        event.auras
          .map((aura) => parseCombatantInfoAuraId(aura))
          .filter((auraId): auraId is number => auraId !== null),
      )

      if (auraIds.length > 0) {
        actorState.auraTracker.seedAuras(auraIds)
      }
    }

    // Store gear
    if (event.gear) {
      actorState.gearTracker.setGear(event.gear)
    }

    const sourceActor: Actor = {
      id: actorState.id,
      name: actorState.name,
      class: actorState.actorClass,
    }
    const wowClass = sourceActor.class as WowClass | null
    const classConfig = wowClass ? config.classes[wowClass] : undefined
    const gear = actorState.gearTracker.getGear()
    const { talentPoints, talentRanks, specId } = buildTalentContext(event)

    const talentImplicationContext = {
      event,
      sourceActor,
      talentPoints,
      talentRanks,
      specId,
    }

    const syntheticAuras = mergeSyntheticAuras([
      config.gearImplications?.(gear),
      classConfig?.gearImplications?.(gear),
      classConfig?.talentImplications?.(talentImplicationContext),
    ])

    if (syntheticAuras.length > 0) {
      actorState.auraTracker.seedAuras(syntheticAuras)
    }
  }

  // Position tracking methods
  getPosition(actor: ActorReference): { x: number; y: number } | null {
    return this.getActorStateByReference(actor)?.getPosition() ?? null
  }

  getDistance(actor1: ActorReference, actor2: ActorReference): number | null {
    const pos1 = this.getPosition(actor1)
    const pos2 = this.getPosition(actor2)

    if (!pos1 || !pos2) {
      return null
    }

    const dx = pos2.x - pos1.x
    const dy = pos2.y - pos1.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  getActorsInRange(actor: ActorReference, maxDistance: number): number[] {
    const sourcePosition = this.getPosition(actor)
    if (!sourcePosition) {
      return []
    }

    const sourceKey = buildActorKey(toActorInstanceReference(actor))

    const actorIdsInRange = [...this.actorStates.entries()]
      .filter(([actorKey]) => actorKey !== sourceKey)
      .flatMap(([, state]) => {
        const otherPosition = state.getPosition()
        if (!otherPosition) {
          return []
        }

        const dx = otherPosition.x - sourcePosition.x
        const dy = otherPosition.y - sourcePosition.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        return distance <= maxDistance ? [state.id] : []
      })

    return [...new Set(actorIdsInRange)]
  }

  getCurrentTarget(
    actor: ActorReference,
  ): { targetId: number; targetInstance: number } | null {
    return this.getActorStateByReference(actor)?.getCurrentTarget() ?? null
  }

  getLastTarget(
    actor: ActorReference,
  ): { targetId: number; targetInstance: number } | null {
    return this.getActorStateByReference(actor)?.getLastTarget() ?? null
  }

  // Threat tracking methods (enemy-owned threat tables)
  getThreat(actorId: ActorId, enemy: EnemyReference): number {
    const sourceKey = this.getThreatSourceKey(actorId)
    return this.getActorStateByReference(enemy)?.getThreatFrom(sourceKey) ?? 0
  }

  getTopActorsByThreat(
    enemy: EnemyReference,
    count: number,
  ): Array<{ actorId: ActorId; threat: number }> {
    const enemyState = this.getActorStateByReference(enemy)
    if (!enemyState) {
      return []
    }

    return enemyState
      .getThreatTableEntries()
      .map(({ actorKey, threat }) => ({
        actor: parseActorKey(actorKey),
        threat,
      }))
      .filter(({ actor, threat }) => actor.instanceId === 0 && threat > 0)
      .map(({ actor, threat }) => ({
        actorId: actor.id,
        threat,
      }))
      .sort((a, b) => b.threat - a.threat)
      .slice(0, count)
  }

  getAllActorThreat(enemy: EnemyReference): Map<ActorId, number> {
    const enemyState = this.getActorStateByReference(enemy)
    if (!enemyState) {
      return new Map()
    }

    return enemyState
      .getThreatTableEntries()
      .map(({ actorKey, threat }) => ({
        actor: parseActorKey(actorKey),
        threat,
      }))
      .filter(({ actor, threat }) => actor.instanceId === 0 && threat > 0)
      .reduce((result, { actor, threat }) => {
        result.set(actor.id, threat)
        return result
      }, new Map<ActorId, number>())
  }

  getAllEnemyThreatEntries(actorId: ActorId): EnemyThreatEntry[] {
    const sourceKey = this.getThreatSourceKey(actorId)

    return [...this.actorStates.entries()]
      .map(([enemyKey, enemyState]) => ({
        enemy: parseActorKey(enemyKey),
        threat: enemyState.getThreatFrom(sourceKey),
      }))
      .filter(({ threat }) => threat > 0)
      .map(({ enemy, threat }) => ({
        enemy: {
          id: enemy.id,
          instanceId: enemy.instanceId,
        },
        threat,
      }))
  }

  addThreat(actorId: ActorId, enemy: EnemyReference, amount: number): void {
    const enemyState = this.getOrCreateActorState(enemy)
    const sourceKey = this.getThreatSourceKey(actorId)

    enemyState.addThreatFrom(sourceKey, amount)
  }

  setThreat(actorId: ActorId, enemy: EnemyReference, amount: number): void {
    const enemyState = this.getOrCreateActorState(enemy)
    const sourceKey = this.getThreatSourceKey(actorId)

    enemyState.setThreatFrom(sourceKey, amount)
  }

  // Actor alive/dead tracking methods
  isActorAlive(actor: ActorReference): boolean {
    return this.getActorStateByReference(actor)?.isAlive ?? true
  }

  /**
   * Clear all threat for an actor against all enemies
   * Returns previous threat entries for each enemy instance that had threat
   */
  clearAllThreatForActor(actorId: ActorId): EnemyThreatEntry[] {
    const sourceKey = this.getThreatSourceKey(actorId)

    return [...this.actorStates.entries()].reduce<EnemyThreatEntry[]>(
      (clearedEntries, [enemyKey, enemyState]) => {
        const threat = enemyState.clearThreatFrom(sourceKey)
        if (threat <= 0) {
          return clearedEntries
        }

        const enemy = parseActorKey(enemyKey)
        clearedEntries.push({
          enemy: {
            id: enemy.id,
            instanceId: enemy.instanceId,
          },
          threat,
        })

        return clearedEntries
      },
      [],
    )
  }
}
