/**
 * Shared Test Helpers
 *
 * Provides common test factories that are framework-agnostic and can be
 * consumed across workspace packages without introducing package cycles.
 */

export interface MockActorRef {
  id: number
  instanceId?: number
}

export interface MockEnemyRef {
  id: number
  instanceId?: number
}

export interface MockActorContext {
  getPosition: (actor: MockActorRef) => { x: number; y: number } | null
  getDistance: (actor1: MockActorRef, actor2: MockActorRef) => number | null
  getActorsInRange: (actor: MockActorRef, maxDistance: number) => number[]
  getThreat: (actorId: number, enemy: MockEnemyRef) => number
  getTopActorsByThreat: (
    enemy: MockEnemyRef,
    count: number,
  ) => Array<{ actorId: number; threat: number }>
  isActorAlive: (actor: MockActorRef) => boolean
  getCurrentTarget: (
    actor: MockActorRef,
  ) => { targetId: number; targetInstance: number } | null
  getLastTarget: (
    actor: MockActorRef,
  ) => { targetId: number; targetInstance: number } | null
}

export interface MockThreatContext {
  event: {
    type: string
    sourceID?: number
    targetID?: number
    [key: string]: unknown
  }
  amount: number
  spellSchoolMask: number
  sourceAuras: Set<number>
  targetAuras: Set<number>
  sourceActor: { id: number; name: string; class: string | null }
  targetActor: { id: number; name: string; class: string | null }
  encounterId: number | null
  actors: MockActorContext
}

/**
 * Create a mock ActorContext with no-op implementations.
 */
export function createMockActorContext(
  overrides: Partial<MockActorContext> = {},
): MockActorContext {
  return {
    getPosition: () => null,
    getDistance: () => null,
    getActorsInRange: () => [],
    getThreat: () => 0,
    getTopActorsByThreat: () => [],
    isActorAlive: () => true,
    getCurrentTarget: () => null,
    getLastTarget: () => null,
    ...overrides,
  }
}

/**
 * Create a mock ThreatContext with sane defaults for unit tests.
 */
export function createMockThreatContext<
  TContext extends MockThreatContext = MockThreatContext,
>(overrides: Partial<TContext> = {}): TContext {
  return {
    event: {
      type: 'damage',
      sourceID: 1,
      targetID: 2,
    },
    amount: 100,
    spellSchoolMask: 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestSource', class: 'warrior' },
    targetActor: { id: 2, name: 'TestTarget', class: null },
    encounterId: null,
    actors: createMockActorContext(),
    ...overrides,
  } as TContext
}
