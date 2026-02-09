/**
 * Fight-level state management
 *
 * Orchestrates per-actor state tracking throughout a fight. Routes events to
 * the appropriate actor's trackers and coordinates cross-tracker concerns
 * (e.g. gear implications producing synthetic auras).
 */
import type { Actor, ThreatConfig, WowClass } from '@wcl-threat/threat-config'
import type { GearItem, WCLEvent } from '@wcl-threat/wcl-types'

import { ActorState } from './actor-state'
import type {
  ActorId,
  ActorKey,
  ActorReference,
  EnemyReference,
} from './instance-refs'
import { buildActorKey, normalizeInstanceId } from './instance-refs'
import type { EnemyThreatEntry } from './threat-tracker'
import { PositionTracker } from './position-tracker'
import { TargetTracker } from './target-tracker'
import { ThreatTracker } from './threat-tracker'

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

type UnknownRecord = Record<string, unknown>
const MAX_TALENT_PARSE_DEPTH = 6

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null
    ? (value as UnknownRecord)
    : null
}

function readNumber(record: UnknownRecord, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return null
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item))
}

function parseTalentPoints(
  event: Extract<WCLEvent, { type: 'combatantinfo' }>,
): number[] {
  if (isFiniteNumberArray(event.talentPoints)) {
    return event.talentPoints
  }

  if (isFiniteNumberArray(event.talents)) {
    return event.talents
  }

  return []
}

function parseTalentRanks(
  event: Extract<WCLEvent, { type: 'combatantinfo' }>,
): Map<number, number> {
  const talentRanks = new Map<number, number>()

  function collectTalentRanks(value: unknown, depth: number): void {
    if (value === null || value === undefined || depth > MAX_TALENT_PARSE_DEPTH) {
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
): { talentPoints: number[]; talentRanks: Map<number, number>; specId: number | null } {
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
  private actors = new Map<ActorId, ActorState>()
  private actorMap: Map<ActorId, Actor>
  private config: ThreatConfig
  private allExclusiveAuras: Set<number>[]
  private positionTracker = new PositionTracker()
  private targetTracker = new TargetTracker()
  private threatTracker = new ThreatTracker()
  private deadActors = new Set<ActorKey>()

  constructor(actorMap: Map<ActorId, Actor>, config: ThreatConfig) {
    this.actorMap = actorMap
    this.config = config
    // Consolidate all exclusive auras from all class configs
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

  /** Process a WCL event and update relevant actor state */
  processEvent(event: WCLEvent, config: ThreatConfig): void {
    // Update positions if available
    if (
      'x' in event &&
      'y' in event &&
      typeof event.x === 'number' &&
      typeof event.y === 'number'
    ) {
      this.positionTracker.updatePosition(
        {
          id: event.sourceID,
          instanceId: normalizeInstanceId(event.sourceInstance),
        },
        event.x,
        event.y,
      )
    }

    switch (event.type) {
      case 'combatantinfo':
        this.processCombatantInfo(event, config)
        break
      case 'cast':
      case 'begincast':
        // Cast activity marks actors as alive and updates target selection.
        this.deadActors.delete(
          buildActorKey({
            id: event.sourceID,
            instanceId: normalizeInstanceId(event.sourceInstance),
          }),
        )
        if (event.targetID !== -1) {
          this.targetTracker.setTarget(
            {
              id: event.sourceID,
              instanceId: normalizeInstanceId(event.sourceInstance),
            },
            {
              targetId: event.targetID,
              targetInstance: normalizeInstanceId(event.targetInstance),
            },
          )
        }
        if (event.type === 'cast') {
          this.processCastAuraImplications(event, config)
        }
        break
      case 'damage':
        if (event.overkill > 0) {
          this.deadActors.add(
            buildActorKey({
              id: event.targetID,
              instanceId: normalizeInstanceId(event.targetInstance),
            }),
          )
        }
        break
      case 'applybuff':
      case 'refreshbuff':
      case 'applybuffstack':
      case 'applydebuff':
      case 'refreshdebuff':
      case 'applydebuffstack':
        this.getOrCreateActorState(event.targetID).auraTracker.addAura(
          event.abilityGameID,
        )
        break
      case 'removebuff':
      case 'removedebuff':
        this.getOrCreateActorState(event.targetID).auraTracker.removeAura(
          event.abilityGameID,
        )
        break
      case 'removebuffstack':
      case 'removedebuffstack':
        if (event.stacks !== undefined && event.stacks <= 0) {
          this.getOrCreateActorState(event.targetID).auraTracker.removeAura(
            event.abilityGameID,
          )
        }
        break
      case 'death':
        this.deadActors.add(
          buildActorKey({
            id: event.targetID,
            instanceId: normalizeInstanceId(event.targetInstance),
          }),
        )
        break
      case 'resurrect':
        this.deadActors.delete(
          buildActorKey({
            id: event.targetID,
            instanceId: normalizeInstanceId(event.targetInstance),
          }),
        )
        break
    }
  }

  /** Process cast-driven aura implications (e.g., form inferred by cast spell). */
  private processCastAuraImplications(
    event: Extract<WCLEvent, { type: 'cast' }>,
    config: ThreatConfig,
  ): void {
    const sourceActor = this.actorMap.get(event.sourceID) ?? null
    const wowClass = sourceActor?.class as WowClass | null
    const classConfig = wowClass ? config.classes[wowClass] : undefined
    const auraImplications = classConfig?.auraImplications

    if (!auraImplications || auraImplications.size === 0) {
      return
    }

    const impliedAuras = [...auraImplications.entries()]
      .filter(([, spellIds]) => spellIds.has(event.abilityGameID))
      .map(([auraId]) => auraId)

    if (impliedAuras.length > 0) {
      this.getOrCreateActorState(event.sourceID).auraTracker.seedAuras(
        dedupeIds(impliedAuras),
      )
    }
  }

  /** Get the composite state for an actor */
  getActorState(actorId: ActorId): ActorState | undefined {
    return this.actors.get(actorId)
  }

  /** Get active auras for an actor (convenience method) */
  getAuras(actorId: ActorId): Set<number> {
    return this.actors.get(actorId)?.auras ?? new Set()
  }

  /** Ensure an aura is active on an actor. */
  setAura(actorId: ActorId, spellId: number): void {
    this.getOrCreateActorState(actorId).auraTracker.addAura(spellId)
  }

  /** Remove an aura from an actor. */
  removeAura(actorId: ActorId, spellId: number): void {
    this.getOrCreateActorState(actorId).auraTracker.removeAura(spellId)
  }

  /** Get equipped gear for an actor (convenience method) */
  getGear(actorId: ActorId): GearItem[] {
    return this.actors.get(actorId)?.gear ?? []
  }

  /**
   * Process a combatantinfo event:
   * seed auras, store gear, and infer synthetic auras from implication hooks.
   */
  private processCombatantInfo(
    event: Extract<WCLEvent, { type: 'combatantinfo' }>,
    config: ThreatConfig,
  ): void {
    const actorState = this.getOrCreateActorState(event.sourceID)

    // Seed initial auras from combatant info
    if (event.auras) {
      actorState.auraTracker.seedAuras(event.auras.map((a) => a.abilityGameID))
    }

    // Store gear
    if (event.gear) {
      actorState.gearTracker.setGear(event.gear)
    }

    const sourceActor = this.actorMap.get(event.sourceID) ?? null
    const wowClass = sourceActor?.class as WowClass | null
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

  /** Get or create an ActorState for the given actor ID */
  private getOrCreateActorState(actorId: ActorId): ActorState {
    let state = this.actors.get(actorId)
    if (!state) {
      // Use consolidated exclusive auras from all classes
      // (e.g., paladin blessings can be applied to any class)
      state = new ActorState(this.allExclusiveAuras)
      this.actors.set(actorId, state)
    }
    return state
  }

  // Position tracking methods
  getPosition(actor: ActorReference) {
    return this.positionTracker.getPosition(actor)
  }

  getDistance(actor1: ActorReference, actor2: ActorReference) {
    return this.positionTracker.getDistance(actor1, actor2)
  }

  getActorsInRange(actor: ActorReference, maxDistance: number) {
    return this.positionTracker.getActorsInRange(actor, maxDistance)
  }

  getCurrentTarget(actor: ActorReference) {
    return this.targetTracker.getCurrentTarget(actor)
  }

  getLastTarget(actor: ActorReference) {
    return this.targetTracker.getLastTarget(actor)
  }

  // Threat tracking methods
  getThreat(actorId: ActorId, enemy: EnemyReference) {
    return this.threatTracker.getThreat(actorId, enemy)
  }

  getTopActorsByThreat(enemy: EnemyReference, count: number) {
    return this.threatTracker.getTopActorsByThreat(enemy, count)
  }

  getAllActorThreat(enemy: EnemyReference) {
    return this.threatTracker.getAllActorThreat(enemy)
  }

  getAllEnemyThreatEntries(actorId: ActorId): EnemyThreatEntry[] {
    return this.threatTracker.getAllEnemyThreatEntries(actorId)
  }

  addThreat(actorId: ActorId, enemy: EnemyReference, amount: number) {
    this.threatTracker.addThreat(actorId, enemy, amount)
  }

  setThreat(actorId: ActorId, enemy: EnemyReference, amount: number) {
    this.threatTracker.setThreat(actorId, enemy, amount)
  }

  // Actor alive/dead tracking methods
  isActorAlive(actor: ActorReference): boolean {
    return !this.deadActors.has(buildActorKey(actor))
  }

  /**
   * Clear all threat for an actor against all enemies
   * Returns previous threat entries for each enemy instance that had threat
   */
  clearAllThreatForActor(actorId: ActorId): EnemyThreatEntry[] {
    return this.threatTracker.clearAllThreatForActor(actorId)
  }
}
