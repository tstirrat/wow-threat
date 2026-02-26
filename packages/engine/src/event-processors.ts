/**
 * Fight Event Processor Framework
 *
 * Defines a two-pass processor lifecycle for event preprocessing and
 * main-pass event effect augmentation.
 */
import type {
  Actor,
  ActorContext,
  Enemy,
  ThreatConfig,
  ThreatEffect,
} from '@wow-threat/shared'
import type { Report, ReportFight, WCLEvent } from '@wow-threat/wcl-types'

export interface ProcessorDataKey<T> {
  readonly id: string
  readonly __type?: T
}

/** Create a strongly-typed key for shared processor namespace state. */
export function createProcessorDataKey<T>(id: string): ProcessorDataKey<T> {
  return { id }
}

export interface ProcessorNamespace {
  get<T>(key: ProcessorDataKey<T>): T | undefined
  set<T>(key: ProcessorDataKey<T>, value: T): void
  has<T>(key: ProcessorDataKey<T>): boolean
}

class DefaultProcessorNamespace implements ProcessorNamespace {
  private readonly values = new Map<string, unknown>()

  get<T>(key: ProcessorDataKey<T>): T | undefined {
    return this.values.get(key.id) as T | undefined
  }

  set<T>(key: ProcessorDataKey<T>, value: T): void {
    this.values.set(key.id, value)
  }

  has<T>(key: ProcessorDataKey<T>): boolean {
    return this.values.has(key.id)
  }
}

/** Create a mutable namespace shared across processor lifecycle stages. */
export function createProcessorNamespace(): ProcessorNamespace {
  return new DefaultProcessorNamespace()
}

export interface ProcessorBaseContext {
  namespace: ProcessorNamespace
  actorMap: Map<number, Actor>
  friendlyActorIds?: Set<number>
  tankActorIds?: Set<number>
  enemies: Enemy[]
  encounterId: number | null
  config: ThreatConfig
  report: Report | null
  fight: ReportFight | null
  inferThreatReduction: boolean
  initialAurasByActor: Map<number, readonly number[]>
}

export interface FightProcessorFactoryContext {
  report: Report | null
  fight: ReportFight | null
  inferThreatReduction: boolean
  tankActorIds?: Set<number>
}

export type FightProcessorFactory = (
  ctx: FightProcessorFactoryContext,
) => FightProcessor | null

export interface PrepassEventContext extends ProcessorBaseContext {
  eventIndex: number
}

export interface MainPassEventContext extends ProcessorBaseContext {
  event: WCLEvent
  eventIndex: number
  fightState: ActorContext
  effects: readonly ThreatEffect[]
  addEffects: (...effects: ThreatEffect[]) => void
}

export interface FightProcessor {
  id: string
  init?(ctx: ProcessorBaseContext): void
  visitPrepass?(event: WCLEvent, ctx: PrepassEventContext): void
  finalizePrepass?(ctx: ProcessorBaseContext): void
  beforeFightState?(ctx: MainPassEventContext): void
  afterFightState?(ctx: MainPassEventContext): void
}

export interface ProcessorRegistry {
  register(processor: FightProcessor): ProcessorRegistry
  registerWhen(
    condition: boolean,
    createProcessor: () => FightProcessor,
  ): ProcessorRegistry
  build(): FightProcessor[]
}

/** Create a fluent registry for request-scoped processor registration. */
export function createProcessorRegistry(
  initialProcessors: FightProcessor[] = [],
): ProcessorRegistry {
  const processors = [...initialProcessors]

  return {
    register(processor) {
      processors.push(processor)
      return this
    },
    registerWhen(condition, createProcessor) {
      if (condition) {
        processors.push(createProcessor())
      }
      return this
    },
    build() {
      return [...processors]
    },
  }
}

export interface RunFightPrepassInput {
  rawEvents: WCLEvent[]
  processors: FightProcessor[]
  baseContext: ProcessorBaseContext
}

/** Execute processor pass-1 lifecycle over events exactly once. */
export function runFightPrepass({
  rawEvents,
  processors,
  baseContext,
}: RunFightPrepassInput): void {
  processors.forEach((processor) => {
    processor.init?.(baseContext)
  })

  rawEvents.forEach((event, eventIndex) => {
    const visitContext: PrepassEventContext = {
      ...baseContext,
      eventIndex,
    }

    processors.forEach((processor) => {
      processor.visitPrepass?.(event, visitContext)
    })
  })

  processors.forEach((processor) => {
    processor.finalizePrepass?.(baseContext)
  })
}

export const initialAuraAdditionsKey = createProcessorDataKey<
  Map<number, Set<number>>
>('engine:initialAuraAdditions')

/** Record an initial aura seed addition for a specific actor. */
export function addInitialAuraAddition(
  namespace: ProcessorNamespace,
  actorId: number,
  auraId: number,
): void {
  const existing = namespace.get(initialAuraAdditionsKey) ?? new Map()
  const actorAuras = existing.get(actorId) ?? new Set<number>()
  actorAuras.add(auraId)
  existing.set(actorId, actorAuras)
  namespace.set(initialAuraAdditionsKey, existing)
}

/** Merge static initial aura seeds with processor-provided additions. */
export function mergeInitialAurasWithAdditions(
  baseInitialAurasByActor: Map<number, readonly number[]>,
  additionsByActor: Map<number, Set<number>> | undefined,
): Map<number, number[]> {
  if (!additionsByActor || additionsByActor.size === 0) {
    return new Map(
      [...baseInitialAurasByActor.entries()].map(([actorId, auraIds]) => [
        actorId,
        [...new Set(auraIds)].sort((left, right) => left - right),
      ]),
    )
  }

  const merged = new Map<number, number[]>(
    [...baseInitialAurasByActor.entries()].map(([actorId, auraIds]) => [
      actorId,
      [...new Set(auraIds)].sort((left, right) => left - right),
    ]),
  )

  additionsByActor.forEach((auraIds, actorId) => {
    const next = new Set(merged.get(actorId) ?? [])
    auraIds.forEach((auraId) => next.add(auraId))
    merged.set(
      actorId,
      [...next].sort((left, right) => left - right),
    )
  })

  return merged
}
