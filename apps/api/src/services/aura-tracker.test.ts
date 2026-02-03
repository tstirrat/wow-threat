/**
 * Tests for per-actor AuraTracker
 */

import { describe, it, expect } from 'vitest'

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
})
