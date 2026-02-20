/**
 * Tests for Warrior Threat Configuration
 */
import {
  createApplyBuffEvent,
  createApplyDebuffEvent,
  createCastEvent,
  createDamageEvent,
  createMockActorContext,
  createResourceChangeEvent,
} from '@wow-threat/shared'
import type {
  TalentImplicationContext,
  ThreatContext,
} from '@wow-threat/shared/src/types'
import { ResourceTypeCode } from '@wow-threat/wcl-types'
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
    event: createDamageEvent(),
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

const legacyWarriorSpellFunctionIds = [
  71, 2457, 2458, 78, 284, 285, 1608, 11564, 11565, 11566, 11567, 25286, 23922,
  23923, 23924, 23925, 72, 1671, 1672, 11601, 25288, 12798, 845, 7369, 11608,
  11609, 20569, 1680, 6343, 8198, 8204, 8205, 11580, 11581, 1715, 7372, 7373,
  20252, 20253, 20616, 20614, 20617, 20615, 20647, 7386, 11597, 6673, 5242,
  6192, 11549, 11550, 11551, 25289, 11556, 20560, 11585, 11574, 355, 1161, 2687,
  29131, 29478, 23602, 12964, 11578, 7922, 18499, 12966, 12967, 12968, 12969,
  12970, 12328, 871, 1719, 12323, 14204, 12975, 12976, 2565, 12721, 6552, 6554,
  23881, 23892, 23893, 23894, 23888, 23885, 23891,
] as const

describe('Spell constants', () => {
  it('has correct spell IDs for core abilities', () => {
    expect(Spells.ShieldSlamR1).toBe(23922)
    expect(Spells.RevengeR6).toBe(25288)
    expect(Spells.SunderArmorR4).toBe(11596)
    expect(Spells.SunderArmorR5).toBe(11597)
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
    expect(modifier.spellIds!.has(Spells.SunderArmorR1)).toBe(true)
    expect(modifier.spellIds!.has(Spells.SunderArmorR5)).toBe(true)
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
        targetID: 1,
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
  it('contains all legacy warrior spell function IDs', () => {
    legacyWarriorSpellFunctionIds.forEach((spellId) => {
      expect(warriorConfig.abilities[spellId]).toBeDefined()
    })
  })

  describe('Shield Slam', () => {
    it('calculates amt + 178 threat for rank 1', () => {
      const formula = warriorConfig.abilities[Spells.ShieldSlamR1]
      expect(formula).toBeDefined()

      const ctx = createMockContext({ amount: 2500 })
      const result = assertDefined(formula!(ctx))

      expect(result.formula).toBe('amt + 178')
      expect(result.value).toBe(2678)
      expect(result.splitAmongEnemies).toBe(false)
    })

    it('supports rank 4 shield slam bonus threat', () => {
      const formula = warriorConfig.abilities[Spells.ShieldSlamR4]
      expect(formula).toBeDefined()

      const ctx = createMockContext({ amount: 1000 })
      const result = assertDefined(formula!(ctx))

      expect(result.formula).toBe('amt + 254')
      expect(result.value).toBe(1254)
      expect(result.splitAmongEnemies).toBe(false)
    })
  })

  describe('Sunder Armor', () => {
    it('applies 261 threat on cast and rolls back on miss', () => {
      const formula = warriorConfig.abilities[Spells.SunderArmorR5]
      expect(formula).toBeDefined()

      const castResult = assertDefined(
        formula!(
          createMockContext({
            event: createCastEvent(),
            amount: 0,
          }),
        ),
      )
      const missResult = assertDefined(
        formula!(
          createMockContext({
            event: createDamageEvent({ hitType: 'miss' }),
            amount: 0,
          }),
        ),
      )

      expect(castResult.formula).toBe('261 (cast)')
      expect(castResult.value).toBe(261)
      expect(missResult.formula).toBe('-261 (miss rollback)')
      expect(missResult.value).toBe(-261)
    })

    it('supports legacy rank 5 threat values', () => {
      const formula = warriorConfig.abilities[Spells.SunderArmorR5]
      expect(formula).toBeDefined()

      const castResult = assertDefined(
        formula!(
          createMockContext({
            event: createCastEvent(),
            amount: 0,
          }),
        ),
      )
      const missResult = assertDefined(
        formula!(
          createMockContext({
            event: createDamageEvent({ hitType: 'miss' }),
            amount: 0,
          }),
        ),
      )

      expect(castResult.formula).toBe('261 (cast)')
      expect(castResult.value).toBe(261)
      expect(missResult.formula).toBe('-261 (miss rollback)')
      expect(missResult.value).toBe(-261)
    })
  })

  describe('Revenge', () => {
    it('calculates (amt * 2.25) + 270 threat on successful hits', () => {
      const formula = warriorConfig.abilities[Spells.RevengeR6]
      expect(formula).toBeDefined()

      const ctx = createMockContext({ amount: 500 })
      const result = assertDefined(formula!(ctx))

      expect(result.formula).toBe('(amt * 2.25) + 270')
      expect(result.value).toBe(1395)
    })

    it('does not apply threat when revenge misses', () => {
      const formula = warriorConfig.abilities[Spells.RevengeR6]
      expect(formula).toBeDefined()

      const ctx = createMockContext({
        event: createDamageEvent({ hitType: 'miss' }),
        amount: 0,
      })

      expect(formula!(ctx)).toBeUndefined()
    })
  })

  describe('Heroic Strike', () => {
    it('calculates amt + 175 threat on successful hits', () => {
      const formula = warriorConfig.abilities[Spells.HeroicStrikeR9]
      expect(formula).toBeDefined()

      const ctx = createMockContext({ amount: 1000 })
      const result = assertDefined(formula!(ctx))

      expect(result.formula).toBe('amt + 175')
      expect(result.value).toBe(1175)
    })

    it('does not apply threat when heroic strike misses', () => {
      const formula = warriorConfig.abilities[Spells.HeroicStrikeR9]
      expect(formula).toBeDefined()

      const ctx = createMockContext({
        event: createDamageEvent({ hitType: 'miss' }),
        amount: 0,
      })

      expect(formula!(ctx)).toBeUndefined()
    })
  })

  describe('Battle Shout', () => {
    it('returns flat 60 threat split among enemies for rank 7', () => {
      const formula = warriorConfig.abilities[Spells.BattleShoutR7]
      expect(formula).toBeDefined()

      const ctx = createMockContext({
        event: createApplyBuffEvent(),
      })
      const result = assertDefined(formula!(ctx))

      expect(result.formula).toBe('60')
      expect(result.value).toBe(60)
      expect(result.splitAmongEnemies).toBe(true)
    })
  })

  describe('Demoralizing Shout', () => {
    it('returns flat 43 threat per target', () => {
      const formula = warriorConfig.abilities[Spells.DemoShoutR7]
      expect(formula).toBeDefined()

      const ctx = createMockContext({
        event: createApplyDebuffEvent(),
      })
      const result = assertDefined(formula!(ctx))

      expect(result.formula).toBe('43')
      expect(result.value).toBe(43)
      expect(result.splitAmongEnemies).toBe(false)
    })

    it('keeps anniversary rank mapped to the same legacy threat value', () => {
      const formula = warriorConfig.abilities[Spells.DemoShoutR7]
      expect(formula).toBeDefined()

      const result = assertDefined(
        formula!(
          createMockContext({
            event: createApplyDebuffEvent(),
          }),
        ),
      )

      expect(result.formula).toBe('43')
      expect(result.value).toBe(43)
    })
  })

  describe('Taunt', () => {
    it('returns custom threat set behavior', () => {
      const formula = warriorConfig.abilities[Spells.Taunt]
      expect(formula).toBeDefined()

      const ctx = createMockContext({
        event: createApplyDebuffEvent(),
        actors: createMockActorContext({
          getThreat: () => 100,
          getTopActorsByThreat: () => [{ actorId: 99, threat: 500 }],
          isActorAlive: () => true,
        }),
      })
      const result = assertDefined(formula!(ctx))

      expect(result.formula).toBe('topThreat + 0')
      expect(result.effects?.[0]).toEqual({
        type: 'customThreat',
        changes: [
          {
            sourceId: 1,
            targetId: 2,
            targetInstance: 0,
            operator: 'set',
            amount: 500,
            total: 500,
          },
        ],
      })
    })
  })

  describe('Pummel', () => {
    it('applies bonus threat for rank 1 on successful hit', () => {
      const formula = warriorConfig.abilities[Spells.PummelR1]
      expect(formula).toBeDefined()

      const result = assertDefined(
        formula!(
          createMockContext({
            amount: 250,
          }),
        ),
      )

      expect(result.formula).toBe('amt + 76')
      expect(result.value).toBe(326)
    })

    it('applies bonus threat for rank 2 on successful hit', () => {
      const formula = warriorConfig.abilities[Spells.PummelR2]
      expect(formula).toBeDefined()

      const result = assertDefined(
        formula!(
          createMockContext({
            amount: 250,
          }),
        ),
      )

      expect(result.formula).toBe('amt + 116')
      expect(result.value).toBe(366)
    })

    it('does not apply threat when pummel misses', () => {
      const formula = warriorConfig.abilities[Spells.PummelR2]
      expect(formula).toBeDefined()

      const result = formula!(
        createMockContext({
          event: createDamageEvent({ hitType: 'miss' }),
          amount: 0,
        }),
      )

      expect(result).toBeUndefined()
    })
  })

  describe('Resource Gain Abilities', () => {
    it('applies coefficients for Bloodrage cast resource gain', () => {
      const formula = warriorConfig.abilities[Spells.BloodrageCast]
      expect(formula).toBeDefined()

      const result = assertDefined(
        formula!(
          createMockContext({
            event: createResourceChangeEvent({
              abilityGameID: 2687,
              resourceChange: 10,
              waste: 0,
              resourceChangeType: ResourceTypeCode.Rage,
            }),
            amount: 10,
          }),
        ),
      )

      expect(result.formula).toBe('amt * 5')
      expect(result.value).toBe(50)
      expect(result.splitAmongEnemies).toBe(true)
      expect(result.applyPlayerMultipliers).toBe(true)
    })

    it('skips coefficients for Bloodrage periodic rage gain', () => {
      const formula = warriorConfig.abilities[Spells.BloodrageRageGain]
      expect(formula).toBeDefined()

      const result = assertDefined(
        formula!(
          createMockContext({
            event: createResourceChangeEvent({
              abilityGameID: 29131,
              resourceChange: 1,
              waste: 0,
              resourceChangeType: ResourceTypeCode.Rage,
            }),
            amount: 1,
          }),
        ),
      )

      expect(result.formula).toBe('amt * 5')
      expect(result.value).toBe(5)
      expect(result.splitAmongEnemies).toBe(true)
      expect(result.applyPlayerMultipliers).toBe(false)
    })
  })

  describe('Mocking Blow', () => {
    it('uses direct damage threat for the rank 5 strike event', () => {
      const formula = warriorConfig.abilities[Spells.MockingBlowR5]
      expect(formula).toBeDefined()

      const ctx = createMockContext({
        event: createDamageEvent(),
        amount: 500,
      })
      const result = assertDefined(formula!(ctx))

      expect(result.formula).toBe('amt')
      expect(result.value).toBe(500)
      expect(result.effects).toBeUndefined()
    })
  })
})
