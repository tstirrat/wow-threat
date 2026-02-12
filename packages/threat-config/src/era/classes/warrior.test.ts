/**
 * Tests for Warrior Threat Configuration
 */
import { createMockActorContext } from '@wcl-threat/shared'
import type {
  TalentImplicationContext,
  ThreatContext,
} from '@wcl-threat/shared/src/types'
import { describe, expect, it } from 'vitest'

import { SetIds, Spells, exclusiveAuras, warriorConfig } from './warrior'

function assertDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined()
  if (value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

// Mock ThreatContext factory
function createMockContext(
  overrides: Partial<ThreatContext> = {},
): ThreatContext {
  const { spellSchoolMask, ...restOverrides } = overrides

  return {
    event: { type: 'damage' } as ThreatContext['event'],
    amount: 100,
    spellSchoolMask: spellSchoolMask ?? 0,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestWarrior', class: 'warrior' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: createMockActorContext(),
    ...restOverrides,
  }
}

describe('Spell constants', () => {
  it('has correct spell IDs for core abilities', () => {
    expect(Spells.ShieldSlam).toBe(23922)
    expect(Spells.Revenge).toBe(25288)
    expect(Spells.SunderArmor).toBe(25225)
    expect(Spells.Taunt).toBe(355)
  })

  it('has correct spell IDs for stances', () => {
    expect(Spells.DefensiveStance).toBe(71)
    expect(Spells.BerserkerStance).toBe(2458)
    expect(Spells.BattleStance).toBe(2457)
  })

  it('has correct set bonus spell IDs', () => {
    expect(Spells.T1_8pc).toBe(23561)
    expect(Spells.T25_4pc).toBe(23302)
  })
})

describe('SetIds', () => {
  it('has correct set ID for T1', () => {
    expect(SetIds.T1).toBe(209)
  })
})

describe('exclusiveAuras', () => {
  it('defines mutually exclusive stances', () => {
    expect(exclusiveAuras).toHaveLength(1)
    expect(exclusiveAuras[0]!.has(Spells.DefensiveStance)).toBe(true)
    expect(exclusiveAuras[0]!.has(Spells.BerserkerStance)).toBe(true)
    expect(exclusiveAuras[0]!.has(Spells.BattleStance)).toBe(true)
  })
})

describe('auraImplications', () => {
  it('maps overpower to implied battle stance', () => {
    const battleImplications = warriorConfig.auraImplications?.get(
      Spells.BattleStance,
    )

    expect(battleImplications).toBeDefined()
    expect(battleImplications?.has(Spells.Overpower)).toBe(true)
  })

  it('maps intercept to implied berserker stance', () => {
    const berserkerImplications = warriorConfig.auraImplications?.get(
      Spells.BerserkerStance,
    )

    expect(berserkerImplications).toBeDefined()
    expect(berserkerImplications?.has(20252)).toBe(true)
  })

  it('maps taunt to implied defensive stance', () => {
    const defensiveImplications = warriorConfig.auraImplications?.get(
      Spells.DefensiveStance,
    )

    expect(defensiveImplications).toBeDefined()
    expect(defensiveImplications?.has(Spells.Taunt)).toBe(true)
  })
})

describe('auraModifiers', () => {
  it('returns Defensive Stance modifier', () => {
    const modifierFn = warriorConfig.auraModifiers[Spells.DefensiveStance]
    expect(modifierFn).toBeDefined()

    const modifier = modifierFn!(createMockContext())

    expect(modifier.name).toBe('Defensive Stance')
    expect(modifier.value).toBe(1.3)
    expect(modifier.source).toBe('stance')
  })

  it('returns Berserker Stance modifier with threat reduction', () => {
    const modifierFn = warriorConfig.auraModifiers[Spells.BerserkerStance]
    expect(modifierFn).toBeDefined()

    const modifier = modifierFn!(createMockContext())

    expect(modifier.name).toBe('Berserker Stance')
    expect(modifier.value).toBe(0.8)
    expect(modifier.source).toBe('stance')
  })

  it('returns Defiance rank 5 modifier', () => {
    const modifierFn = warriorConfig.auraModifiers[Spells.DefianceRank5]
    expect(modifierFn).toBeDefined()

    const modifier = modifierFn!(createMockContext())

    expect(modifier.name).toBe('Defiance (Rank 5)')
    expect(modifier.value).toBe(1.15)
    expect(modifier.source).toBe('talent')
  })

  it('returns T25 4pc set bonus modifier', () => {
    const modifierFn = warriorConfig.auraModifiers[Spells.T25_4pc]
    expect(modifierFn).toBeDefined()

    const modifier = modifierFn!(createMockContext())

    expect(modifier.name).toBe('Conqueror 4pc')
    expect(modifier.value).toBe(1.1)
    expect(modifier.source).toBe('gear')
  })

  it('returns T1 8pc set bonus modifier scoped to Sunder Armor', () => {
    const modifierFn = warriorConfig.auraModifiers[Spells.T1_8pc]
    expect(modifierFn).toBeDefined()

    const modifier = modifierFn!(createMockContext())

    expect(modifier.name).toBe('Might 8pc')
    expect(modifier.value).toBe(1.15)
    expect(modifier.source).toBe('gear')
    expect(modifier.spellIds).toBeDefined()
    expect(modifier.spellIds!.has(Spells.SunderArmor)).toBe(true)
  })
})

describe('gearImplications', () => {
  it('returns T1_8pc when 8+ Might pieces equipped', () => {
    const gear = [
      { id: 1, setID: SetIds.T1 },
      { id: 2, setID: SetIds.T1 },
      { id: 3, setID: SetIds.T1 },
      { id: 4, setID: SetIds.T1 },
      { id: 5, setID: SetIds.T1 },
      { id: 6, setID: SetIds.T1 },
      { id: 7, setID: SetIds.T1 },
      { id: 8, setID: SetIds.T1 },
    ]

    const result = warriorConfig.gearImplications!(gear)

    expect(result).toContain(Spells.T1_8pc)
  })

  it('returns empty when fewer than 8 Might pieces equipped', () => {
    const gear = [
      { id: 1, setID: SetIds.T1 },
      { id: 2, setID: SetIds.T1 },
      { id: 3, setID: SetIds.T1 },
      { id: 4, setID: SetIds.T1 },
      { id: 5, setID: SetIds.T1 },
      { id: 6, setID: SetIds.T1 },
      { id: 7, setID: SetIds.T1 },
    ]

    const result = warriorConfig.gearImplications!(gear)

    expect(result).toHaveLength(0)
  })

  it('returns empty when no set pieces equipped', () => {
    const gear = [{ id: 1 }, { id: 2 }, { id: 3 }]

    const result = warriorConfig.gearImplications!(gear)

    expect(result).toHaveLength(0)
  })
})

describe('talentImplications', () => {
  function createTalentContext(
    overrides: Partial<TalentImplicationContext> = {},
  ): TalentImplicationContext {
    return {
      event: {
        timestamp: 0,
        type: 'combatantinfo',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 1,
        targetIsFriendly: true,
      },
      sourceActor: { id: 1, name: 'TestWarrior', class: 'warrior' },
      talentPoints: [0, 0, 0],
      talentRanks: new Map(),
      specId: null,
      ...overrides,
    }
  }

  it('infers Defiance aura from ranked talent payload', () => {
    const result = warriorConfig.talentImplications!(
      createTalentContext({
        talentRanks: new Map([[Spells.Defiance, 5]]),
      }),
    )

    expect(result).toEqual([Spells.DefianceRank5])
  })

  it('infers Defiance aura from direct rank spell IDs', () => {
    const result = warriorConfig.talentImplications!(
      createTalentContext({
        talentRanks: new Map([[Spells.DefianceRank3, 1]]),
      }),
    )

    expect(result).toEqual([Spells.DefianceRank3])
  })

  it('infers Defiance rank 5 from protection tree split at threshold', () => {
    const result = warriorConfig.talentImplications!(
      createTalentContext({
        talentPoints: [20, 6, 14],
      }),
    )

    expect(result).toEqual([Spells.DefianceRank5])
  })

  it('does not infer Defiance when protection tree points are below threshold', () => {
    const result = warriorConfig.talentImplications!(
      createTalentContext({
        talentPoints: [20, 7, 13],
      }),
    )

    expect(result).toEqual([])
  })

  it('infers Defiance rank 5 for legacy 0/32/19 tree split payloads', () => {
    const result = warriorConfig.talentImplications!(
      createTalentContext({
        talentPoints: [0, 32, 19],
      }),
    )

    expect(result).toEqual([Spells.DefianceRank5])
  })

  it('prefers explicit ranked talent payload over tree-split inference', () => {
    const result = warriorConfig.talentImplications!(
      createTalentContext({
        talentPoints: [14, 5, 31],
        talentRanks: new Map([[Spells.DefianceRank2, 1]]),
      }),
    )

    expect(result).toEqual([Spells.DefianceRank2])
  })

  it('returns no synthetic aura when Defiance is absent', () => {
    const result = warriorConfig.talentImplications!(
      createTalentContext({
        talentRanks: new Map([[999999, 3]]),
      }),
    )

    expect(result).toEqual([])
  })
})

describe('abilities', () => {
  describe('Shield Slam', () => {
    it('calculates (amt * 2) + 150 threat', () => {
      const formula = warriorConfig.abilities[Spells.ShieldSlam]
      expect(formula).toBeDefined()

      const ctx = createMockContext({ amount: 2500 })
      const result = assertDefined(formula!(ctx))

      expect(result.formula).toBe('(amt * 2) + 150')
      expect(result.value).toBe(5150) // (2500 * 2) + 150
      expect(result.splitAmongEnemies).toBe(false)
    })
  })

  describe('Sunder Armor', () => {
    it('applies 301 threat on cast and rolls back on miss', () => {
      const formula = warriorConfig.abilities[Spells.SunderArmor]
      expect(formula).toBeDefined()

      const castResult = assertDefined(formula!(
        createMockContext({
          event: { type: 'cast' } as ThreatContext['event'],
          amount: 0,
        }),
      ))
      const missResult = assertDefined(formula!(
        createMockContext({
          event: {
            type: 'damage',
            hitType: 'miss',
          } as ThreatContext['event'],
          amount: 0,
        }),
      ))

      expect(castResult.formula).toBe('301 (cast)')
      expect(castResult.value).toBe(301)
      expect(missResult.formula).toBe('-301 (miss rollback)')
      expect(missResult.value).toBe(-301)
    })
  })

  describe('Revenge', () => {
    it('calculates amt + 355 threat', () => {
      const formula = warriorConfig.abilities[Spells.Revenge]
      expect(formula).toBeDefined()

      const ctx = createMockContext({ amount: 500 })
      const result = assertDefined(formula!(ctx))

      expect(result.formula).toBe('amt + 355')
      expect(result.value).toBe(855)
    })
  })

  describe('Heroic Strike', () => {
    it('calculates amt + 145 threat', () => {
      const formula = warriorConfig.abilities[Spells.HeroicStrike]
      expect(formula).toBeDefined()

      const ctx = createMockContext({ amount: 1000 })
      const result = assertDefined(formula!(ctx))

      expect(result.formula).toBe('amt + 145')
      expect(result.value).toBe(1145)
    })
  })

  describe('Battle Shout', () => {
    it('returns flat 70 threat split among enemies', () => {
      const formula = warriorConfig.abilities[Spells.BattleShout]
      expect(formula).toBeDefined()

      const ctx = createMockContext({
        event: { type: 'applybuff' } as ThreatContext['event'],
      })
      const result = assertDefined(formula!(ctx))

      expect(result.formula).toBe('70')
      expect(result.value).toBe(70)
      expect(result.splitAmongEnemies).toBe(true)
    })
  })

  describe('Demoralizing Shout', () => {
    it('returns flat 56 threat per target', () => {
      const formula = warriorConfig.abilities[Spells.DemoShout]
      expect(formula).toBeDefined()

      const ctx = createMockContext({
        event: { type: 'applydebuff' } as ThreatContext['event'],
      })
      const result = assertDefined(formula!(ctx))

      expect(result.formula).toBe('56')
      expect(result.value).toBe(56)
      expect(result.splitAmongEnemies).toBe(false)
    })
  })

  describe('Taunt', () => {
    it('returns custom threat set behavior', () => {
      const formula = warriorConfig.abilities[Spells.Taunt]
      expect(formula).toBeDefined()

      const ctx = createMockContext({
        event: { type: 'applydebuff' } as ThreatContext['event'],
        actors: createMockActorContext({
          getThreat: () => 100,
          getTopActorsByThreat: () => [{ actorId: 99, threat: 500 }],
          isActorAlive: () => true,
        }),
      })
      const result = assertDefined(formula!(ctx))

      expect(result.formula).toBe('topThreat + 1')
      expect(result.effects?.[0]).toEqual({
        type: 'customThreat',
        changes: [
          {
            sourceId: 1,
            targetId: 2,
            targetInstance: 0,
            operator: 'set',
            amount: 501,
            total: 501,
          },
        ],
      })
    })
  })

  describe('Mocking Blow', () => {
    it('returns custom threat set behavior with damage bonus', () => {
      const formula = warriorConfig.abilities[Spells.MockingBlow]
      expect(formula).toBeDefined()

      const ctx = createMockContext({
        event: { type: 'applydebuff' } as ThreatContext['event'],
        amount: 500,
        actors: createMockActorContext({
          getThreat: () => 100,
          getTopActorsByThreat: () => [{ actorId: 99, threat: 400 }],
          isActorAlive: () => true,
        }),
      })
      const result = assertDefined(formula!(ctx))

      expect(result.formula).toBe('topThreat + amt')
      expect(result.value).toBe(0)
      expect(result.effects?.[0]).toEqual({
        type: 'customThreat',
        changes: [
          {
            sourceId: 1,
            targetId: 2,
            targetInstance: 0,
            operator: 'set',
            amount: 900,
            total: 900,
          },
        ],
      })
    })
  })
})
