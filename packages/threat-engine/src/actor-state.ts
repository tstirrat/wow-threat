/**
 * Per-actor state container
 *
 * Stores runtime state for a specific actor instance during a fight.
 * Includes metadata, aura/gear trackers, lifecycle state, targeting,
 * position, and enemy-owned threat tables.
 */
import type { Actor, RuntimeActorView } from '@wcl-threat/shared'
import type { GearItem, WCLEvent } from '@wcl-threat/wcl-types'

import { AuraTracker } from './aura-tracker'
import { GearTracker } from './gear-tracker'
import type { ActorKey } from './instance-refs'

export interface ActorPosition {
  x: number
  y: number
}

export interface ActorTargetReference {
  targetId: number
  targetInstance: number
}

export interface ThreatTableEntry {
  actorKey: ActorKey
  threat: number
}

interface ActorStateOptions {
  profile: Actor
  instanceId: number
  exclusiveAuras?: Set<number>[]
}

export const positionUpdateActorByEventType: Map<
  WCLEvent['type'],
  'source' | 'target'
> = new Map<WCLEvent['type'], 'source' | 'target'>([
  ['damage', 'target'],
  ['absorbed', 'target'],
  ['heal', 'target'],
  ['applybuff', 'target'],
  ['refreshbuff', 'target'],
  ['applybuffstack', 'target'],
  ['removebuff', 'target'],
  ['removebuffstack', 'target'],
  ['applydebuff', 'target'],
  ['refreshdebuff', 'target'],
  ['applydebuffstack', 'target'],
  ['removedebuff', 'target'],
  ['removedebuffstack', 'target'],
  ['energize', 'source'],
  ['resourcechange', 'source'],
  ['cast', 'source'],
  ['begincast', 'source'],
  ['interrupt', 'target'],
  ['death', 'target'],
  ['resurrect', 'target'],
  ['summon', 'source'],
  ['combatantinfo', 'source'],
])

function hasPosition(
  event: WCLEvent,
): event is WCLEvent & { x: number; y: number } {
  return typeof event.x === 'number' && typeof event.y === 'number'
}

/** Composite state for a single actor during a fight */
export class ActorState {
  readonly id: number
  readonly instanceId: number
  readonly name: string
  readonly actorClass: Actor['class']

  readonly auraTracker: AuraTracker
  readonly gearTracker = new GearTracker()
  private alive = true
  private position: ActorPosition | null = null
  private currentTarget: ActorTargetReference | null = null
  private lastTarget: ActorTargetReference | null = null
  private threatTable = new Map<ActorKey, number>()

  constructor(options: ActorStateOptions) {
    this.id = options.profile.id
    this.instanceId = options.instanceId
    this.name = options.profile.name
    this.actorClass = options.profile.class
    this.auraTracker = new AuraTracker(options.exclusiveAuras)
  }

  /** Get active aura spell IDs */
  get auras(): Set<number> {
    return this.auraTracker.getAuras()
  }

  /** Get equipped gear */
  get gear(): GearItem[] {
    return this.gearTracker.getGear()
  }

  /** Check whether the actor is currently alive. */
  get isAlive(): boolean {
    return this.alive
  }

  /** Get current position. */
  getPosition(): ActorPosition | null {
    return this.position ? { ...this.position } : null
  }

  /** Get current target reference. */
  getCurrentTarget(): ActorTargetReference | null {
    return this.currentTarget ? { ...this.currentTarget } : null
  }

  /** Get previous target reference. */
  getLastTarget(): ActorTargetReference | null {
    return this.lastTarget ? { ...this.lastTarget } : null
  }

  /** Update actor position directly from event x/y when present. */
  updatePosition(event: WCLEvent): boolean {
    if (!hasPosition(event)) {
      return false
    }

    this.position = {
      x: event.x,
      y: event.y,
    }

    return true
  }

  /** Mark actor dead. */
  markDead(): void {
    this.alive = false
  }

  /** Mark actor alive. */
  markAlive(): void {
    this.alive = true
  }

  /** Update current target and retain previous target when target changes. */
  setTarget(target: ActorTargetReference): void {
    if (
      this.currentTarget &&
      (this.currentTarget.targetId !== target.targetId ||
        this.currentTarget.targetInstance !== target.targetInstance)
    ) {
      this.lastTarget = this.currentTarget
    }

    this.currentTarget = { ...target }
  }

  /** Read threat-table value from a source actor instance key. */
  getThreatFrom(actorKey: ActorKey): number {
    return this.threatTable.get(actorKey) ?? 0
  }

  /** Add threat-table value from a source actor instance key. */
  addThreatFrom(actorKey: ActorKey, amount: number): void {
    const current = this.getThreatFrom(actorKey)
    this.setThreatFrom(actorKey, current + amount)
  }

  /** Set threat-table value from a source actor instance key. */
  setThreatFrom(actorKey: ActorKey, amount: number): void {
    const clampedAmount = Math.max(0, amount)
    if (clampedAmount === 0) {
      this.threatTable.delete(actorKey)
      return
    }
    this.threatTable.set(actorKey, clampedAmount)
  }

  /** Clear and return threat-table value from one source actor instance key. */
  clearThreatFrom(actorKey: ActorKey): number {
    const previous = this.getThreatFrom(actorKey)
    this.threatTable.delete(actorKey)
    return previous
  }

  /** Get all positive threat-table entries. */
  getThreatTableEntries(): ThreatTableEntry[] {
    return Array.from(this.threatTable.entries()).map(([entryKey, threat]) => ({
      actorKey: entryKey,
      threat,
    }))
  }

  /** Build a read-only runtime snapshot for formula/interceptor contexts. */
  getRuntimeView(): RuntimeActorView {
    return {
      id: this.id,
      instanceId: this.instanceId,
      name: this.name,
      class: this.actorClass,
      alive: this.alive,
      position: this.position ? { ...this.position } : null,
      currentTarget: this.currentTarget ? { ...this.currentTarget } : null,
      lastTarget: this.lastTarget ? { ...this.lastTarget } : null,
      auras: new Set(this.auras),
    }
  }
}
