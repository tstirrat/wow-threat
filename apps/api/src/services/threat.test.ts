/**
 * Tests for Threat Calculation Service
 */

import { describe, it, expect } from 'vitest'
import type { WCLEvent, DamageEvent, HealEvent } from '@wcl-threat/wcl-types'
import {
  type ThreatConfig,
  type Enemy,
  type Actor,
} from '@wcl-threat/threat-config'
import { calculateThreat, AuraTracker } from './threat'
import { anniversaryConfig } from '@wcl-threat/threat-config'

// Test helpers
function createDamageEvent(overrides: Partial<DamageEvent> = {}): DamageEvent {
  return {
    timestamp: 1000,
    type: 'damage',
    sourceID: 1,
    sourceIsFriendly: true,
    targetID: 25,
    targetIsFriendly: false,
    ability: {
      guid: 12345,
      name: 'Test Attack',
      type: 1,
      abilityIcon: 'test.jpg',
    },
    amount: 1000,
    absorbed: 0,
    blocked: 0,
    mitigated: 0,
    overkill: 0,
    hitType: 'hit',
    tick: false,
    multistrike: false,
    ...overrides,
  }
}

function createHealEvent(overrides: Partial<HealEvent> = {}): HealEvent {
  return {
    timestamp: 1000,
    type: 'heal',
    sourceID: 2,
    sourceIsFriendly: true,
    targetID: 1,
    targetIsFriendly: true,
    ability: {
      guid: 25314,
      name: 'Greater Heal',
      type: 2,
      abilityIcon: 'heal.jpg',
    },
    amount: 4000,
    absorbed: 0,
    overheal: 500,
    tick: false,
    ...overrides,
  }
}

const defaultActor: Actor = { id: 1, name: 'TestPlayer', class: 'warrior' }
const defaultEnemy: Enemy = { id: 25, name: 'TestBoss', instance: 0 }

describe('calculateThreat', () => {
  const config = anniversaryConfig

  describe('damage events', () => {
    it('calculates basic damage threat', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateThreat(
        event,
        {
          sourceAuras: new Set(),
          targetAuras: new Set(),
          enemies: [defaultEnemy],
          sourceActor: defaultActor,
          targetActor: { id: 25, name: 'Boss', class: null },
          encounterId: null,
        },
        config
      )

      expect(result.calculation.baseThreat).toBe(1000)
      expect(result.calculation.threatToEnemy).toBe(1000)
      expect(result.values).toHaveLength(1)
      expect(result.values[0]?.amount).toBe(1000)
      expect(result.values[0]?.isSplit).toBe(false)
    })

    it('applies Defensive Stance modifier', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateThreat(
        event,
        {
          sourceAuras: new Set([71]), // Defensive Stance
          targetAuras: new Set(),
          enemies: [defaultEnemy],
          sourceActor: defaultActor,
          targetActor: { id: 25, name: 'Boss', class: null },
          encounterId: null,
        },
        config
      )

      expect(result.calculation.modifiers).toContainEqual(
        expect.objectContaining({ name: 'Defensive Stance', value: 1.3 })
      )
      expect(result.calculation.threatToEnemy).toBe(1300) // 1000 * 1.3
    })

    it('applies multiple modifiers multiplicatively', () => {
      const event = createDamageEvent({ amount: 1000 })

      const result = calculateThreat(
        event,
        {
          // Defensive Stance (1.3) + Defiance Rank 5 (1.15)
          sourceAuras: new Set([71, 12305]),
          targetAuras: new Set(),
          enemies: [defaultEnemy],
          sourceActor: defaultActor,
          targetActor: { id: 25, name: 'Boss', class: null },
          encounterId: null,
        },
        config
      )

      expect(result.calculation.modifiers).toHaveLength(2)
      // 1000 * 1.3 * 1.15 = 1495
      expect(result.calculation.threatToEnemy).toBeCloseTo(1495, 0)
    })
  })

  describe('healing events', () => {
    it('calculates healing threat split among enemies', () => {
      const event = createHealEvent({
        amount: 4000,
        overheal: 500,
      })

      const enemies = [
        { id: 25, name: 'Boss', instance: 0 },
        { id: 26, name: 'Add', instance: 0 },
      ]

      const result = calculateThreat(
        event,
        {
          sourceAuras: new Set(),
          targetAuras: new Set(),
          enemies,
          sourceActor: { id: 2, name: 'Healer', class: 'priest' },
          targetActor: defaultActor,
          encounterId: null,
        },
        config
      )

      // Effective heal: 3500, base threat: 1750, split 2 ways: 875 each
      expect(result.calculation.baseThreat).toBe(1750)
      expect(result.values).toHaveLength(2)
      expect(result.values[0]?.amount).toBe(875)
      expect(result.values[0]?.isSplit).toBe(true)
      expect(result.values[1]?.amount).toBe(875)
    })
  })
})

describe('AuraTracker', () => {
  it('tracks applied buffs', () => {
    const tracker = new AuraTracker()

    tracker.processEvent({
      timestamp: 0,
      type: 'applybuff',
      sourceID: 1,
      sourceIsFriendly: true,
      targetID: 1,
      targetIsFriendly: true,
      ability: { guid: 71, name: 'Defensive Stance', type: 1, abilityIcon: '' },
    } as WCLEvent)

    const auras = tracker.getAuras(1)
    expect(auras.has(71)).toBe(true)
  })

  it('removes buffs on removebuff event', () => {
    const tracker = new AuraTracker()

    tracker.processEvent({
      timestamp: 0,
      type: 'applybuff',
      sourceID: 1,
      sourceIsFriendly: true,
      targetID: 1,
      targetIsFriendly: true,
      ability: { guid: 71, name: 'Defensive Stance', type: 1, abilityIcon: '' },
    } as WCLEvent)

    tracker.processEvent({
      timestamp: 100,
      type: 'removebuff',
      sourceID: 1,
      sourceIsFriendly: true,
      targetID: 1,
      targetIsFriendly: true,
      ability: { guid: 71, name: 'Defensive Stance', type: 1, abilityIcon: '' },
    } as WCLEvent)

    const auras = tracker.getAuras(1)
    expect(auras.has(71)).toBe(false)
  })

  it('returns empty set for unknown actors', () => {
    const tracker = new AuraTracker()
    const auras = tracker.getAuras(999)
    expect(auras.size).toBe(0)
  })
})
