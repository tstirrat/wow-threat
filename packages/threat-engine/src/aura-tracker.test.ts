/**
 * Tests for per-actor AuraTracker
 */
import { describe, expect, it } from 'vitest'

import { AuraTracker } from './aura-tracker'

describe('AuraTracker', () => {
  it('adds an aura', () => {
    const tracker = new AuraTracker()

    tracker.addAura(71)

    expect(tracker.getAuras().has(71)).toBe(true)
  })

  it('removes an aura', () => {
    const tracker = new AuraTracker()

    tracker.addAura(71)
    tracker.removeAura(71)

    expect(tracker.getAuras().has(71)).toBe(false)
  })

  it('returns empty set when no auras are active', () => {
    const tracker = new AuraTracker()

    expect(tracker.getAuras().size).toBe(0)
  })

  it('tracks multiple auras independently', () => {
    const tracker = new AuraTracker()

    tracker.addAura(71)
    tracker.addAura(2457)

    expect(tracker.getAuras().has(71)).toBe(true)
    expect(tracker.getAuras().has(2457)).toBe(true)
  })

  it('removing a non-existent aura is a no-op', () => {
    const tracker = new AuraTracker()

    tracker.removeAura(999)

    expect(tracker.getAuras().size).toBe(0)
  })

  it('seeds multiple auras at once', () => {
    const tracker = new AuraTracker()

    tracker.seedAuras([71, 2457, 25780])

    expect(tracker.getAuras().size).toBe(3)
    expect(tracker.getAuras().has(71)).toBe(true)
    expect(tracker.getAuras().has(2457)).toBe(true)
    expect(tracker.getAuras().has(25780)).toBe(true)
  })

  it('seeded auras can be removed normally', () => {
    const tracker = new AuraTracker()

    tracker.seedAuras([71, 2457])
    tracker.removeAura(71)

    expect(tracker.getAuras().has(71)).toBe(false)
    expect(tracker.getAuras().has(2457)).toBe(true)
  })

  it('seeding merges with existing auras', () => {
    const tracker = new AuraTracker()

    tracker.addAura(71)
    tracker.seedAuras([2457, 25780])

    expect(tracker.getAuras().size).toBe(3)
    expect(tracker.getAuras().has(71)).toBe(true)
  })

  describe('exclusive aura handling', () => {
    it('removes other auras in the same exclusive set when adding a new aura', () => {
      const exclusiveSets = [
        new Set([71, 2457, 2458]), // Warrior stances
      ]
      const tracker = new AuraTracker(exclusiveSets)

      tracker.addAura(71) // Defensive Stance
      tracker.addAura(2457) // Battle Stance - should remove Defensive

      expect(tracker.getAuras().has(71)).toBe(false)
      expect(tracker.getAuras().has(2457)).toBe(true)
    })

    it('handles multiple exclusive sets independently', () => {
      const exclusiveSets = [
        new Set([71, 2457, 2458]), // Warrior stances
        new Set([5487, 768]), // Druid forms
      ]
      const tracker = new AuraTracker(exclusiveSets)

      tracker.addAura(71) // Defensive Stance
      tracker.addAura(5487) // Bear Form
      tracker.addAura(2457) // Battle Stance - should remove Defensive but keep Bear Form

      expect(tracker.getAuras().has(71)).toBe(false)
      expect(tracker.getAuras().has(2457)).toBe(true)
      expect(tracker.getAuras().has(5487)).toBe(true)
    })

    it('allows non-exclusive auras alongside exclusive ones', () => {
      const exclusiveSets = [new Set([71, 2457, 2458])]
      const tracker = new AuraTracker(exclusiveSets)

      tracker.addAura(71) // Defensive Stance (exclusive)
      tracker.addAura(999) // Some other buff (non-exclusive)
      tracker.addAura(2457) // Battle Stance (exclusive, replaces Defensive)

      expect(tracker.getAuras().has(71)).toBe(false)
      expect(tracker.getAuras().has(2457)).toBe(true)
      expect(tracker.getAuras().has(999)).toBe(true) // Non-exclusive remains
    })

    it('seeds auras respecting exclusivity', () => {
      const exclusiveSets = [new Set([71, 2457, 2458])]
      const tracker = new AuraTracker(exclusiveSets)

      // When seeding multiple exclusive auras, last one wins
      tracker.seedAuras([71, 999, 2457])

      expect(tracker.getAuras().has(71)).toBe(false)
      expect(tracker.getAuras().has(2457)).toBe(true)
      expect(tracker.getAuras().has(999)).toBe(true)
    })

    it('works without exclusive auras configured', () => {
      const tracker = new AuraTracker()

      tracker.addAura(71)
      tracker.addAura(2457)

      // Without exclusive sets, both should remain
      expect(tracker.getAuras().has(71)).toBe(true)
      expect(tracker.getAuras().has(2457)).toBe(true)
    })
  })
})
