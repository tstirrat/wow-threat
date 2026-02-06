import type { DamageEvent } from '@wcl-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import type { ActorContext, ThreatContext } from '../types'
import { hatefulStrike } from './naxx'

describe('Hateful Strike', () => {
  const PATCHWERK_ID = 16028

  function createMockActorContext(
    topActors: Array<{ actorId: number; threat: number }>,
    distances: Map<string, number>,
  ): ActorContext {
    return {
      getPosition: () => ({ x: 0, y: 0 }),
      getDistance: (actorId1, actorId2) => {
        const key = `${actorId1}-${actorId2}`
        return distances.get(key) ?? null
      },
      getActorsInRange: () => [],
      getThreat: () => 0,
      getTopActorsByThreat: () => topActors,
    }
  }

  function createMockContext(actors: ActorContext): ThreatContext {
    return {
      event: {
        sourceID: PATCHWERK_ID,
        targetID: 1,
        type: 'damage',
      } as DamageEvent,
      amount: 5000,
      sourceAuras: new Set(),
      targetAuras: new Set(),
      sourceActor: { id: PATCHWERK_ID, name: 'Patchwerk', class: null },
      targetActor: { id: 1, name: 'Tank', class: 'warrior' },
      encounterId: null,
      actors,
    }
  }

  it('should apply threat to top 4 melee-range targets', () => {
    const topActors = [
      { actorId: 1, threat: 1000 },
      { actorId: 2, threat: 900 },
      { actorId: 3, threat: 800 },
      { actorId: 4, threat: 700 },
      { actorId: 5, threat: 600 },
      { actorId: 6, threat: 500 },
    ]

    // Actors 1-4 are in melee range, 5-6 are not
    const distances = new Map([
      ['1-16028', 5],
      ['2-16028', 8],
      ['3-16028', 10],
      ['4-16028', 9],
      ['5-16028', 15],
      ['6-16028', 20],
    ])

    const actors = createMockActorContext(topActors, distances)
    const ctx = createMockContext(actors)

    const result = hatefulStrike(ctx)

    expect(result.value).toBe(0) // Boss ability on player
    expect(result.special?.type).toBe('customThreat')

    if (result.special?.type === 'customThreat') {
      expect(result.special.modifications).toHaveLength(4)
      expect(result.special.modifications.map((m) => m.actorId)).toEqual([
        1, 2, 3, 4,
      ])
      expect(
        result.special.modifications.every((m) => m.enemyId === PATCHWERK_ID),
      ).toBe(true)
      expect(result.special.modifications.every((m) => m.amount === 1000)).toBe(
        true,
      )
    }
  })

  it('should handle fewer than 4 melee targets', () => {
    const topActors = [
      { actorId: 1, threat: 1000 },
      { actorId: 2, threat: 900 },
    ]

    const distances = new Map([
      ['1-16028', 5],
      ['2-16028', 8],
    ])

    const actors = createMockActorContext(topActors, distances)
    const ctx = createMockContext(actors)

    const result = hatefulStrike(ctx)

    if (result.special?.type === 'customThreat') {
      expect(result.special.modifications).toHaveLength(2)
      expect(result.special.modifications.map((m) => m.actorId)).toEqual([1, 2])
    }
  })

  it('should filter out actors beyond melee range', () => {
    const topActors = [
      { actorId: 1, threat: 1000 }, // In range
      { actorId: 2, threat: 900 }, // Out of range
      { actorId: 3, threat: 800 }, // In range
      { actorId: 4, threat: 700 }, // Out of range
      { actorId: 5, threat: 600 }, // In range
      { actorId: 6, threat: 500 }, // In range
    ]

    const distances = new Map([
      ['1-16028', 5],
      ['2-16028', 15],
      ['3-16028', 10],
      ['4-16028', 20],
      ['5-16028', 8],
      ['6-16028', 9],
    ])

    const actors = createMockActorContext(topActors, distances)
    const ctx = createMockContext(actors)

    const result = hatefulStrike(ctx)

    if (result.special?.type === 'customThreat') {
      expect(result.special.modifications).toHaveLength(4)
      // Should be actors 1, 3, 5, 6 (in melee range, sorted by threat)
      expect(result.special.modifications.map((m) => m.actorId)).toEqual([
        1, 3, 5, 6,
      ])
    }
  })

  it('should handle actors with null distance', () => {
    const topActors = [
      { actorId: 1, threat: 1000 },
      { actorId: 2, threat: 900 },
      { actorId: 3, threat: 800 },
    ]

    const distances = new Map([
      ['1-16028', 5],
      // Actor 2 has no distance (null)
      ['3-16028', 8],
    ])

    const actors = createMockActorContext(topActors, distances)
    const ctx = createMockContext(actors)

    const result = hatefulStrike(ctx)

    if (result.special?.type === 'customThreat') {
      // Should only include actors 1 and 3 (with valid distances)
      expect(result.special.modifications).toHaveLength(2)
      expect(result.special.modifications.map((m) => m.actorId)).toEqual([1, 3])
    }
  })

  it('should return empty modifications when no actors in range', () => {
    const topActors = [
      { actorId: 1, threat: 1000 },
      { actorId: 2, threat: 900 },
    ]

    const distances = new Map([
      ['1-16028', 15],
      ['2-16028', 20],
    ])

    const actors = createMockActorContext(topActors, distances)
    const ctx = createMockContext(actors)

    const result = hatefulStrike(ctx)

    if (result.special?.type === 'customThreat') {
      expect(result.special.modifications).toHaveLength(0)
    }
  })

  it('should use correct formula string', () => {
    const actors = createMockActorContext([], new Map())
    const ctx = createMockContext(actors)

    const result = hatefulStrike(ctx)

    expect(result.formula).toBe('0 (customThreat)')
    expect(result.splitAmongEnemies).toBe(false)
  })
})
