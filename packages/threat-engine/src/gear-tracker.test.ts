/**
 * Tests for per-actor GearTracker
 */
import { describe, expect, it } from 'vitest'

import { GearTracker } from './gear-tracker'

describe('GearTracker', () => {
  it('starts with empty gear', () => {
    const tracker = new GearTracker()

    expect(tracker.getGear()).toEqual([])
  })

  it('stores gear from setGear', () => {
    const tracker = new GearTracker()
    const gear = [
      { id: 19019, setID: 498 },
      { id: 18814, temporaryEnchant: 2505 },
    ]

    tracker.setGear(gear)

    expect(tracker.getGear()).toEqual(gear)
  })

  it('replaces gear on subsequent setGear calls', () => {
    const tracker = new GearTracker()
    const initialGear = [{ id: 19019, setID: 498 }]
    const updatedGear = [{ id: 21134 }, { id: 21268 }]

    tracker.setGear(initialGear)
    tracker.setGear(updatedGear)

    expect(tracker.getGear()).toEqual(updatedGear)
    expect(tracker.getGear()).toHaveLength(2)
  })
})
