import {
  checkExists,
  createCastEvent,
  createMockActorContext,
} from '@wcl-threat/shared'
import type { ActorContext, ThreatContext } from '@wcl-threat/shared/src/types'
import type { DamageEvent } from '@wcl-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import { hatefulStrike, naxxAbilities } from './naxx'

describe('Hateful Strike', () => {
  const PATCHWERK_ID = 16028

  function createNaxxActorContext(
    topActors: Array<{ actorId: number; threat: number }>,
    distances: Map<string, number>,
  ): ActorContext {
    return createMockActorContext({
      getPosition: () => ({ x: 0, y: 0 }),
      getDistance: (actor1, actor2) => {
        const key = `${actor1.id}-${actor2.id}`
        return distances.get(key) ?? null
      },
      getTopActorsByThreat: () => topActors,
    })
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
      spellSchoolMask: 0,
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

    const actors = createNaxxActorContext(topActors, distances)
    const ctx = createMockContext(actors)

    const result = checkExists(hatefulStrike(ctx))

    expect(result.value).toBe(0) // Boss ability on player
    expect(result.effects?.[0]?.type).toBe('customThreat')

    if (result.effects?.[0]?.type === 'customThreat') {
      expect(result.effects?.[0]?.changes).toHaveLength(4)
      expect(result.effects?.[0]?.changes.map((c) => c.sourceId)).toEqual([
        1, 2, 3, 4,
      ])
      expect(
        result.effects?.[0]?.changes.every((c) => c.targetId === PATCHWERK_ID),
      ).toBe(true)
      expect(result.effects?.[0]?.changes.every((c) => c.amount === 1000)).toBe(
        true,
      )
      expect(
        result.effects?.[0]?.changes.every((c) => c.operator === 'add'),
      ).toBe(true)
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

    const actors = createNaxxActorContext(topActors, distances)
    const ctx = createMockContext(actors)

    const result = checkExists(hatefulStrike(ctx))

    if (result.effects?.[0]?.type === 'customThreat') {
      expect(result.effects?.[0]?.changes).toHaveLength(2)
      expect(result.effects?.[0]?.changes.map((c) => c.sourceId)).toEqual([
        1, 2,
      ])
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

    const actors = createNaxxActorContext(topActors, distances)
    const ctx = createMockContext(actors)

    const result = checkExists(hatefulStrike(ctx))

    if (result.effects?.[0]?.type === 'customThreat') {
      expect(result.effects?.[0]?.changes).toHaveLength(4)
      // Should be actors 1, 3, 5, 6 (in melee range, sorted by threat)
      expect(result.effects?.[0]?.changes.map((c) => c.sourceId)).toEqual([
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

    const actors = createNaxxActorContext(topActors, distances)
    const ctx = createMockContext(actors)

    const result = checkExists(hatefulStrike(ctx))

    if (result.effects?.[0]?.type === 'customThreat') {
      // Should only include actors 1 and 3 (with valid distances)
      expect(result.effects?.[0]?.changes).toHaveLength(2)
      expect(result.effects?.[0]?.changes.map((c) => c.sourceId)).toEqual([
        1, 3,
      ])
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

    const actors = createNaxxActorContext(topActors, distances)
    const ctx = createMockContext(actors)

    const result = checkExists(hatefulStrike(ctx))

    if (result.effects?.[0]?.type === 'customThreat') {
      expect(result.effects?.[0]?.changes).toHaveLength(0)
    }
  })

  it('should use correct formula string', () => {
    const actors = createNaxxActorContext([], new Map())
    const ctx = createMockContext(actors)

    const result = checkExists(hatefulStrike(ctx))

    expect(result.formula).toBe('0 (customThreat)')
    expect(result.splitAmongEnemies).toBe(false)
  })
})

describe('Boss Threat Wipe on Cast', () => {
  function createThreatWipeContext(abilityGameID: number): ThreatContext {
    return {
      event: createCastEvent({
        sourceID: 15954,
        targetID: 1,
        type: 'cast',
        abilityGameID,
      }),
      amount: 0,
      spellSchoolMask: 0,
      sourceAuras: new Set(),
      targetAuras: new Set(),
      sourceActor: { id: 15954, name: 'Noth the Plaguebringer', class: null },
      targetActor: { id: 1, name: 'Tank', class: 'warrior' },
      encounterId: null,
      actors: createMockActorContext(),
    }
  }

  it('returns modifyThreat special that targets all actors on source enemy', () => {
    const result = checkExists(
      naxxAbilities[29210]!(createThreatWipeContext(29210)),
    )

    expect(result.formula).toBe('threatWipe')
    expect(result.value).toBe(0)
    expect(result.effects?.[0]).toEqual({
      type: 'modifyThreat',
      multiplier: 0,
      target: 'all',
    })
  })

  it('registers both known Noth blink spell IDs', () => {
    const blink = naxxAbilities[29210]
    const blinkAlt = naxxAbilities[29211]

    expect(blink).toBeDefined()
    expect(blinkAlt).toBeDefined()

    const blinkResult = checkExists(blink!(createThreatWipeContext(29210)))
    const blinkAltResult = checkExists(
      blinkAlt!(createThreatWipeContext(29211)),
    )

    expect(blinkResult.effects?.[0]).toEqual({
      type: 'modifyThreat',
      multiplier: 0,
      target: 'all',
    })
    expect(blinkAltResult.effects?.[0]).toEqual({
      type: 'modifyThreat',
      multiplier: 0,
      target: 'all',
    })
  })
})
