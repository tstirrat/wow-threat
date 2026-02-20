import {
  checkExists,
  createCastEvent,
  createDamageEvent,
  createMockActorContext,
} from '@wow-threat/shared'
import type { ActorContext, ThreatContext } from '@wow-threat/shared/src/types'
import type { DamageEvent } from '@wow-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import { hatefulStrike, magneticPull, naxxAbilities } from './naxx'

describe('Hateful Strike', () => {
  const PATCHWERK_ID = 16028
  const HATEFUL_AMOUNT = 500
  const formula = hatefulStrike({ amount: HATEFUL_AMOUNT, playerCount: 4 })

  function createNaxxActorContext(
    topActors: Array<{ actorId: number; threat: number }>,
    distances: Map<string, number>,
    threatByActorId: Map<number, number> = new Map(),
  ): ActorContext {
    const topThreatByActorId = new Map(
      topActors.map(({ actorId, threat }) => [actorId, threat]),
    )

    return createMockActorContext({
      getPosition: () => ({ x: 0, y: 0 }),
      getDistance: (actor1, actor2) => {
        const key = `${actor1.id}-${actor2.id}`
        return distances.get(key) ?? null
      },
      getThreat: (actorId) =>
        threatByActorId.get(actorId) ?? topThreatByActorId.get(actorId) ?? 0,
      getTopActorsByThreat: () => topActors,
    })
  }

  function createMockContext(
    actors: ActorContext,
    targetId: number = 1,
  ): ThreatContext {
    return {
      event: createDamageEvent({
        sourceID: PATCHWERK_ID,
        sourceIsFriendly: false,
        targetID: targetId,
        targetIsFriendly: true,
      }) as DamageEvent,
      amount: 5000,
      sourceAuras: new Set(),
      targetAuras: new Set(),
      sourceActor: { id: PATCHWERK_ID, name: 'Patchwerk', class: null },
      targetActor: { id: targetId, name: 'Tank', class: 'warrior' },
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
      ['1-16028', 1000],
      ['2-16028', 1200],
      ['3-16028', 1300],
      ['4-16028', 1400],
      ['5-16028', 1700],
      ['6-16028', 2000],
    ])

    const actors = createNaxxActorContext(topActors, distances)
    const ctx = createMockContext(actors)

    const result = checkExists(formula(ctx))

    expect(result.value).toBe(500)
    expect(result.effects?.[0]?.type).toBe('customThreat')

    if (result.effects?.[0]?.type === 'customThreat') {
      expect(result.effects?.[0]?.changes).toHaveLength(4)
      expect(result.effects?.[0]?.changes.map((c) => c.sourceId)).toEqual([
        1, 2, 3, 4,
      ])
      expect(
        result.effects?.[0]?.changes.every((c) => c.targetId === PATCHWERK_ID),
      ).toBe(true)
      expect(result.effects?.[0]?.changes.every((c) => c.amount === 500)).toBe(
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
      ['1-16028', 1000],
      ['2-16028', 1200],
    ])

    const actors = createNaxxActorContext(topActors, distances)
    const ctx = createMockContext(actors)

    const result = checkExists(formula(ctx))

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
      ['1-16028', 1000],
      ['2-16028', 3500],
      ['3-16028', 1200],
      ['4-16028', 4000],
      ['5-16028', 1300],
      ['6-16028', 1400],
    ])

    const actors = createNaxxActorContext(topActors, distances)
    const ctx = createMockContext(actors)

    const result = checkExists(formula(ctx))

    if (result.effects?.[0]?.type === 'customThreat') {
      expect(result.effects?.[0]?.changes).toHaveLength(4)
      // Should be actors 1, 3, 5, 6 (in melee range, sorted by threat)
      expect(result.effects?.[0]?.changes.map((c) => c.sourceId)).toEqual([
        1, 3, 5, 6,
      ])
    }
  })

  it('should use top threat ordering when no distance data exists', () => {
    const topActors = [
      { actorId: 1, threat: 1000 },
      { actorId: 2, threat: 900 },
      { actorId: 3, threat: 800 },
      { actorId: 4, threat: 700 },
      { actorId: 5, threat: 600 },
    ]

    const actors = createNaxxActorContext(topActors, new Map())
    const ctx = createMockContext(actors)

    const result = checkExists(formula(ctx))

    if (result.effects?.[0]?.type === 'customThreat') {
      expect(result.effects?.[0]?.changes).toHaveLength(4)
      expect(result.effects?.[0]?.changes.map((c) => c.sourceId)).toEqual([
        1, 2, 3, 4,
      ])
    }
  })

  it('should ignore null distance actors when at least one distance exists', () => {
    const topActors = [
      { actorId: 1, threat: 1000 },
      { actorId: 2, threat: 900 },
      { actorId: 3, threat: 800 },
    ]

    const distances = new Map([
      ['1-16028', 1000],
      // Actor 2 has no distance (null)
      ['3-16028', 1200],
    ])

    const actors = createNaxxActorContext(topActors, distances)
    const ctx = createMockContext(actors)

    const result = checkExists(formula(ctx))

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
      ['1-16028', 3500],
      ['2-16028', 4000],
    ])

    const actors = createNaxxActorContext(topActors, distances)
    const ctx = createMockContext(actors)

    const result = checkExists(formula(ctx))

    if (result.effects?.[0]?.type === 'customThreat') {
      // Direct target is always included.
      expect(result.effects?.[0]?.changes).toHaveLength(1)
      expect(result.effects?.[0]?.changes.map((c) => c.sourceId)).toEqual([1])
    }
  })

  it('should include direct target even when not in top threat list', () => {
    const topActors = [
      { actorId: 2, threat: 1200 },
      { actorId: 3, threat: 1100 },
      { actorId: 4, threat: 1000 },
      { actorId: 5, threat: 900 },
    ]

    const distances = new Map([
      ['2-16028', 1000],
      ['3-16028', 1200],
      ['4-16028', 1300],
      ['5-16028', 3500],
    ])

    const actors = createNaxxActorContext(
      topActors,
      distances,
      new Map([[1, 750]]),
    )
    const ctx = createMockContext(actors, 1)

    const result = checkExists(formula(ctx))

    if (result.effects?.[0]?.type === 'customThreat') {
      expect(result.effects?.[0]?.changes.map((c) => c.sourceId)).toEqual([
        1, 2, 3, 4,
      ])
      expect(result.effects?.[0]?.changes[0]).toMatchObject({
        sourceId: 1,
        amount: 500,
        total: 1250,
      })
    }
  })

  it('should include direct target even when target distance is out of melee range', () => {
    const topActors = [
      { actorId: 1, threat: 1000 },
      { actorId: 2, threat: 900 },
      { actorId: 3, threat: 800 },
      { actorId: 4, threat: 700 },
      { actorId: 5, threat: 600 },
    ]

    const distances = new Map([
      ['1-16028', 3500], // Out of melee; still must be included as direct target
      ['2-16028', 1000],
      ['3-16028', 1200],
      ['4-16028', 1300],
      ['5-16028', 1600],
    ])

    const actors = createNaxxActorContext(topActors, distances)
    const ctx = createMockContext(actors, 1)

    const result = checkExists(formula(ctx))

    if (result.effects?.[0]?.type === 'customThreat') {
      expect(result.effects?.[0]?.changes.map((c) => c.sourceId)).toEqual([
        1, 2, 3, 4,
      ])
    }
  })

  it('should not duplicate the direct target in additional slots', () => {
    const topActors = [
      { actorId: 1, threat: 1000 },
      { actorId: 2, threat: 900 },
      { actorId: 3, threat: 800 },
      { actorId: 4, threat: 700 },
      { actorId: 5, threat: 600 },
    ]

    const distances = new Map([
      ['1-16028', 1000],
      ['2-16028', 1100],
      ['3-16028', 1200],
      ['4-16028', 1300],
      ['5-16028', 1800],
    ])

    const actors = createNaxxActorContext(topActors, distances)
    const ctx = createMockContext(actors, 1)

    const result = checkExists(formula(ctx))

    if (result.effects?.[0]?.type === 'customThreat') {
      const sourceIds = result.effects?.[0]?.changes.map((c) => c.sourceId)
      expect(sourceIds).toEqual([1, 2, 3, 4])
      expect(sourceIds.filter((id) => id === 1)).toHaveLength(1)
    }
  })

  it('should use correct formula string', () => {
    const actors = createNaxxActorContext([], new Map())
    const ctx = createMockContext(actors)

    const result = checkExists(formula(ctx))

    expect(result.formula).toBe('hatefulStrike(500)')
    expect(result.splitAmongEnemies).toBe(false)
  })
})

describe('Magnetic Pull', () => {
  function createMagneticPullContext(actors: ActorContext): ThreatContext {
    const event = createCastEvent({
      sourceID: 250,
      sourceIsFriendly: false,
      targetID: 1,
      targetIsFriendly: true,
      abilityGameID: 28339,
    })

    return {
      event,
      amount: 0,
      spellSchoolMask: 0,
      sourceAuras: new Set(),
      targetAuras: new Set(),
      sourceActor: { id: 250, name: 'Feugen', class: null },
      targetActor: { id: 1, name: 'Tank', class: 'warrior' },
      encounterId: null,
      actors,
    }
  }

  it('sets source threat to max source threat for top non-source-tank on other enemy', () => {
    const sourceEnemy = { id: 250, instanceId: 0 }
    const partnerEnemy = { id: 249, instanceId: 0 }

    const actors = createMockActorContext({
      getTopActorsByThreat: (enemy) => {
        if (enemy.id === sourceEnemy.id) {
          return [
            { actorId: 1, threat: 1000 },
            { actorId: 2, threat: 450 },
          ]
        }

        if (enemy.id === partnerEnemy.id) {
          return [
            { actorId: 1, threat: 1400 },
            { actorId: 3, threat: 1100 },
          ]
        }

        return []
      },
      getFightEnemies: () => [sourceEnemy, partnerEnemy],
    })

    const result = checkExists(magneticPull(createMagneticPullContext(actors)))
    expect(result.formula).toBe('magneticPull(sourceMaxThreat)')
    expect(result.effects?.[0]).toEqual({
      type: 'customThreat',
      changes: [
        {
          sourceId: 3,
          targetId: 250,
          targetInstance: 0,
          operator: 'set',
          amount: 1000,
          total: 1000,
        },
      ],
    })
  })

  it('returns undefined when no opposite-platform enemy has threat', () => {
    const actors = createMockActorContext({
      getTopActorsByThreat: (enemy) =>
        enemy.id === 250 ? [{ actorId: 1, threat: 1000 }] : [],
      getFightEnemies: () => [{ id: 250, instanceId: 0 }],
    })

    const result = magneticPull(createMagneticPullContext(actors))
    expect(result).toBeUndefined()
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
