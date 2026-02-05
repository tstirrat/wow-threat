/**
 * Tests for Warrior Threat Configuration
 */

import { describe, it, expect } from 'vitest'
import type { ThreatContext } from '../../types'
import { warriorConfig, Spells, exclusiveAuras, SetIds } from './warrior'

// Mock ThreatContext factory
function createMockContext(overrides: Partial<ThreatContext> = {}): ThreatContext {
  return {
    event: { type: 'damage' } as ThreatContext['event'],
    amount: 100,
    sourceAuras: new Set(),
    targetAuras: new Set(),
    sourceActor: { id: 1, name: 'TestWarrior', class: 'warrior' },
    targetActor: { id: 2, name: 'TestEnemy', class: null },
    encounterId: null,
    actors: {
      getPosition: () => null,
      getDistance: () => null,
      getActorsInRange: () => [],
      getThreat: () => 0,
      getTopActorsByThreat: () => [],
    },
    ...overrides,
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
    const gear = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]

    const result = warriorConfig.gearImplications!(gear)

    expect(result).toHaveLength(0)
  })
})

describe('abilities', () => {
  describe('Shield Slam', () => {
    it('calculates (amt * 2) + 150 threat', () => {
      const formula = warriorConfig.abilities[Spells.ShieldSlam]
      expect(formula).toBeDefined()

      const ctx = createMockContext({ amount: 2500 })
      const result = formula!(ctx)

      expect(result.formula).toBe('(amt * 2) + 150')
      expect(result.value).toBe(5150) // (2500 * 2) + 150
      expect(result.splitAmongEnemies).toBe(false)
    })
  })

  describe('Sunder Armor', () => {
    it('returns flat 301 threat', () => {
      const formula = warriorConfig.abilities[Spells.SunderArmor]
      expect(formula).toBeDefined()

      const ctx = createMockContext({ amount: 0 })
      const result = formula!(ctx)

      expect(result.formula).toBe('301')
      expect(result.value).toBe(301)
    })
  })

  describe('Revenge', () => {
    it('calculates amt + 355 threat', () => {
      const formula = warriorConfig.abilities[Spells.Revenge]
      expect(formula).toBeDefined()

      const ctx = createMockContext({ amount: 500 })
      const result = formula!(ctx)

      expect(result.formula).toBe('amt + 355')
      expect(result.value).toBe(855)
    })
  })

  describe('Heroic Strike', () => {
    it('calculates amt + 145 threat', () => {
      const formula = warriorConfig.abilities[Spells.HeroicStrike]
      expect(formula).toBeDefined()

      const ctx = createMockContext({ amount: 1000 })
      const result = formula!(ctx)

      expect(result.formula).toBe('amt + 145')
      expect(result.value).toBe(1145)
    })
  })

  describe('Battle Shout', () => {
    it('returns flat 70 threat split among enemies', () => {
      const formula = warriorConfig.abilities[Spells.BattleShout]
      expect(formula).toBeDefined()

      const ctx = createMockContext()
      const result = formula!(ctx)

      expect(result.formula).toBe('70')
      expect(result.value).toBe(70)
      expect(result.splitAmongEnemies).toBe(true)
    })
  })

  describe('Demoralizing Shout', () => {
    it('returns flat 56 threat per target', () => {
      const formula = warriorConfig.abilities[Spells.DemoShout]
      expect(formula).toBeDefined()

      const ctx = createMockContext()
      const result = formula!(ctx)

      expect(result.formula).toBe('56')
      expect(result.value).toBe(56)
      expect(result.splitAmongEnemies).toBe(false)
    })
  })

  describe('Taunt', () => {
    it('returns taunt with fixate', () => {
      const formula = warriorConfig.abilities[Spells.Taunt]
      expect(formula).toBeDefined()

      const ctx = createMockContext()
      const result = formula!(ctx)

      expect(result.formula).toBe('topThreat + 1')
      expect(result.special).toEqual({ type: 'taunt', fixateDuration: 3000 })
    })
  })

  describe('Mocking Blow', () => {
    it('returns taunt with damage and 6s fixate', () => {
      const formula = warriorConfig.abilities[Spells.MockingBlow]
      expect(formula).toBeDefined()

      const ctx = createMockContext({ amount: 500 })
      const result = formula!(ctx)

      expect(result.formula).toBe('topThreat + amt + 0')
      expect(result.value).toBe(500)
      expect(result.special).toEqual({ type: 'taunt', fixateDuration: 6000 })
    })
  })
})
