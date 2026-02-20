import { describe, expect, it } from 'vitest'

import { ThreatTracker } from './threat-tracker'

describe('ThreatTracker', () => {
  it('should add and retrieve threat for an actor against an enemy', () => {
    const tracker = new ThreatTracker()

    tracker.addThreat(1, { id: 100 }, 500)

    expect(tracker.getThreat(1, { id: 100 })).toBe(500)
  })

  it('should return 0 for unknown actor/enemy combinations', () => {
    const tracker = new ThreatTracker()

    expect(tracker.getThreat(1, { id: 100 })).toBe(0)
  })

  it('should accumulate threat for the same actor/enemy', () => {
    const tracker = new ThreatTracker()

    tracker.addThreat(1, { id: 100 }, 500)
    tracker.addThreat(1, { id: 100 }, 300)
    tracker.addThreat(1, { id: 100 }, 200)

    expect(tracker.getThreat(1, { id: 100 })).toBe(1000)
  })

  it('should track threat separately for different enemies', () => {
    const tracker = new ThreatTracker()

    tracker.addThreat(1, { id: 100 }, 500)
    tracker.addThreat(1, { id: 200 }, 300)

    expect(tracker.getThreat(1, { id: 100 })).toBe(500)
    expect(tracker.getThreat(1, { id: 200 })).toBe(300)
  })

  it('should track threat separately for enemy instances', () => {
    const tracker = new ThreatTracker()

    tracker.addThreat(1, { id: 100, instanceId: 0 }, 500)
    tracker.addThreat(1, { id: 100, instanceId: 1 }, 300)

    expect(tracker.getThreat(1, { id: 100, instanceId: 0 })).toBe(500)
    expect(tracker.getThreat(1, { id: 100, instanceId: 1 })).toBe(300)
    expect(tracker.getThreat(1, { id: 100, instanceId: 2 })).toBe(0)
  })

  it('should track threat separately for different actors', () => {
    const tracker = new ThreatTracker()

    tracker.addThreat(1, { id: 100 }, 500)
    tracker.addThreat(2, { id: 100 }, 300)

    expect(tracker.getThreat(1, { id: 100 })).toBe(500)
    expect(tracker.getThreat(2, { id: 100 })).toBe(300)
  })

  it('should get top actors by threat', () => {
    const tracker = new ThreatTracker()

    tracker.addThreat(1, { id: 100 }, 1000)
    tracker.addThreat(2, { id: 100 }, 500)
    tracker.addThreat(3, { id: 100 }, 1500)
    tracker.addThreat(4, { id: 100 }, 200)

    const topActors = tracker.getTopActorsByThreat({ id: 100 }, 3)

    expect(topActors).toHaveLength(3)
    expect(topActors[0]).toEqual({ actorId: 3, threat: 1500 })
    expect(topActors[1]).toEqual({ actorId: 1, threat: 1000 })
    expect(topActors[2]).toEqual({ actorId: 2, threat: 500 })
  })

  it('should get top actors by threat for a specific enemy instance', () => {
    const tracker = new ThreatTracker()

    tracker.addThreat(1, { id: 100, instanceId: 0 }, 1000)
    tracker.addThreat(2, { id: 100, instanceId: 0 }, 500)
    tracker.addThreat(3, { id: 100, instanceId: 1 }, 1500)

    const topActorsInstance0 = tracker.getTopActorsByThreat(
      { id: 100, instanceId: 0 },
      10,
    )
    const topActorsInstance1 = tracker.getTopActorsByThreat(
      { id: 100, instanceId: 1 },
      10,
    )

    expect(topActorsInstance0).toEqual([
      { actorId: 1, threat: 1000 },
      { actorId: 2, threat: 500 },
    ])
    expect(topActorsInstance1).toEqual([{ actorId: 3, threat: 1500 }])
  })

  it('should return all actors when count exceeds available actors', () => {
    const tracker = new ThreatTracker()

    tracker.addThreat(1, { id: 100 }, 1000)
    tracker.addThreat(2, { id: 100 }, 500)

    const topActors = tracker.getTopActorsByThreat({ id: 100 }, 10)

    expect(topActors).toHaveLength(2)
  })

  it('should only return actors with positive threat', () => {
    const tracker = new ThreatTracker()

    tracker.addThreat(1, { id: 100 }, 1000)
    tracker.addThreat(2, { id: 100 }, 0)

    const topActors = tracker.getTopActorsByThreat({ id: 100 }, 10)

    expect(topActors).toHaveLength(1)
    expect(topActors[0]?.actorId).toBe(1)
  })

  it('should return empty array for unknown enemy', () => {
    const tracker = new ThreatTracker()

    tracker.addThreat(1, { id: 100 }, 1000)

    const topActors = tracker.getTopActorsByThreat({ id: 999 }, 10)

    expect(topActors).toEqual([])
  })

  it('should get all actor threat for an enemy', () => {
    const tracker = new ThreatTracker()

    tracker.addThreat(1, { id: 100 }, 1000)
    tracker.addThreat(2, { id: 100 }, 500)
    tracker.addThreat(3, { id: 100 }, 1500)

    const allThreat = tracker.getAllActorThreat({ id: 100 })

    expect(allThreat.size).toBe(3)
    expect(allThreat.get(1)).toBe(1000)
    expect(allThreat.get(2)).toBe(500)
    expect(allThreat.get(3)).toBe(1500)
  })

  it('should handle negative threat values', () => {
    const tracker = new ThreatTracker()

    tracker.addThreat(1, { id: 100 }, 1000)
    tracker.addThreat(1, { id: 100 }, -300)

    expect(tracker.getThreat(1, { id: 100 })).toBe(700)
  })

  it('should floor additive threat at 0', () => {
    const tracker = new ThreatTracker()

    tracker.addThreat(1, { id: 100 }, 100)
    tracker.addThreat(1, { id: 100 }, -200)

    expect(tracker.getThreat(1, { id: 100 })).toBe(0)
  })

  it('clearAllThreatForActor should return enemy instance entries', () => {
    const tracker = new ThreatTracker()

    tracker.addThreat(1, { id: 100, instanceId: 0 }, 250)
    tracker.addThreat(1, { id: 100, instanceId: 1 }, 300)
    tracker.addThreat(1, { id: 200, instanceId: 2 }, 400)

    const cleared = tracker.clearAllThreatForActor(1)

    expect(cleared).toEqual(
      expect.arrayContaining([
        { enemy: { id: 100, instanceId: 0 }, threat: 250 },
        { enemy: { id: 100, instanceId: 1 }, threat: 300 },
        { enemy: { id: 200, instanceId: 2 }, threat: 400 },
      ]),
    )
    expect(tracker.getThreat(1, { id: 100, instanceId: 0 })).toBe(0)
    expect(tracker.getThreat(1, { id: 100, instanceId: 1 })).toBe(0)
    expect(tracker.getThreat(1, { id: 200, instanceId: 2 })).toBe(0)
  })
})
