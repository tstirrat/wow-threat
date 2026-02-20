import { describe, expect, it } from 'vitest'

import { PositionTracker } from './position-tracker'

describe('PositionTracker', () => {
  it('should update and retrieve actor positions', () => {
    const tracker = new PositionTracker()

    tracker.updatePosition({ id: 1 }, 100, 200)
    tracker.updatePosition({ id: 2 }, 150, 250)

    expect(tracker.getPosition({ id: 1 })).toEqual({ x: 100, y: 200 })
    expect(tracker.getPosition({ id: 2 })).toEqual({ x: 150, y: 250 })
  })

  it('should return null for unknown actor positions', () => {
    const tracker = new PositionTracker()

    expect(tracker.getPosition({ id: 999 })).toBeNull()
  })

  it('should update existing actor positions', () => {
    const tracker = new PositionTracker()

    tracker.updatePosition({ id: 1 }, 100, 200)
    tracker.updatePosition({ id: 1 }, 300, 400)

    expect(tracker.getPosition({ id: 1 })).toEqual({ x: 300, y: 400 })
  })

  it('should calculate distance between two actors', () => {
    const tracker = new PositionTracker()

    tracker.updatePosition({ id: 1 }, 0, 0)
    tracker.updatePosition({ id: 2 }, 3, 4)

    const distance = tracker.getDistance({ id: 1 }, { id: 2 })
    expect(distance).toBe(5) // 3-4-5 triangle
  })

  it('should return null for distance when positions are missing', () => {
    const tracker = new PositionTracker()

    tracker.updatePosition({ id: 1 }, 0, 0)

    expect(tracker.getDistance({ id: 1 }, { id: 999 })).toBeNull()
    expect(tracker.getDistance({ id: 999 }, { id: 1 })).toBeNull()
    expect(tracker.getDistance({ id: 999 }, { id: 888 })).toBeNull()
  })

  it('should find actors within range', () => {
    const tracker = new PositionTracker()

    // Actor 1 at origin
    tracker.updatePosition({ id: 1 }, 0, 0)
    // Actor 2 at distance 5
    tracker.updatePosition({ id: 2 }, 3, 4)
    // Actor 3 at distance 10
    tracker.updatePosition({ id: 3 }, 6, 8)
    // Actor 4 at distance 15
    tracker.updatePosition({ id: 4 }, 9, 12)

    const actorsInRange = tracker.getActorsInRange({ id: 1 }, 10)

    expect(actorsInRange).toHaveLength(2)
    expect(actorsInRange).toContain(2)
    expect(actorsInRange).toContain(3)
    expect(actorsInRange).not.toContain(1) // Should not include self
    expect(actorsInRange).not.toContain(4) // Out of range
  })

  it('should return empty array when actor position is unknown', () => {
    const tracker = new PositionTracker()

    tracker.updatePosition({ id: 1 }, 0, 0)

    const actorsInRange = tracker.getActorsInRange({ id: 999 }, 10)
    expect(actorsInRange).toEqual([])
  })

  it('should handle zero range correctly', () => {
    const tracker = new PositionTracker()

    tracker.updatePosition({ id: 1 }, 0, 0)
    tracker.updatePosition({ id: 2 }, 0, 0) // Same position
    tracker.updatePosition({ id: 3 }, 1, 0) // Distance 1

    const actorsInRange = tracker.getActorsInRange({ id: 1 }, 0)

    expect(actorsInRange).toHaveLength(1)
    expect(actorsInRange).toContain(2)
  })

  it('tracks positions separately per actor instance', () => {
    const tracker = new PositionTracker()

    tracker.updatePosition({ id: 10, instanceId: 1 }, 0, 0)
    tracker.updatePosition({ id: 10, instanceId: 2 }, 30, 40)

    expect(tracker.getPosition({ id: 10, instanceId: 1 })).toEqual({
      x: 0,
      y: 0,
    })
    expect(tracker.getPosition({ id: 10, instanceId: 2 })).toEqual({
      x: 30,
      y: 40,
    })
    expect(
      tracker.getDistance({ id: 10, instanceId: 1 }, { id: 10, instanceId: 2 }),
    ).toBe(50)
  })
})
