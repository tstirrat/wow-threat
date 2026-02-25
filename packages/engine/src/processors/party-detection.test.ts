/**
 * Tests for party-detection processor.
 */
import { createApplyBuffEvent, createHealEvent } from '@wow-threat/shared'
import type { Actor } from '@wow-threat/shared'
import type {
  PlayerClass,
  Report,
  ReportActor,
  ReportFight,
  ReportFightNPC,
} from '@wow-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import {
  type ProcessorBaseContext,
  createProcessorNamespace,
  runFightPrepass,
} from '../event-processors'
import { createMockThreatConfig } from '../test/helpers/config'
import {
  createPartyDetectionProcessor,
  partyAssignmentsKey,
} from './party-detection'

function createPlayerActor(
  id: number,
  name: string,
  subType: PlayerClass,
): ReportActor {
  return {
    id,
    name,
    type: 'Player',
    subType,
  }
}

function createPetActor(
  id: number,
  name: string,
  petOwner: number,
): ReportActor {
  return {
    id,
    name,
    type: 'Pet',
    petOwner,
  }
}

function createFightPet(id: number, petOwner: number): ReportFightNPC {
  return {
    id,
    gameID: id,
    instanceCount: 1,
    groupCount: 1,
    petOwner,
  }
}

function createFight(
  id: number,
  encounterID: number,
  friendlyPlayers: number[],
  friendlyPetOwners: Array<{ petId: number; ownerId: number }> = [],
): ReportFight {
  return {
    id,
    encounterID,
    name: 'Processor Test Fight',
    startTime: 1000,
    endTime: 10_000,
    kill: true,
    difficulty: null,
    bossPercentage: null,
    fightPercentage: null,
    enemyNPCs: [],
    enemyPets: [],
    friendlyPlayers,
    friendlyPets: friendlyPetOwners.map(({ petId, ownerId }) =>
      createFightPet(petId, ownerId),
    ),
  }
}

function createReport({
  actors,
  fight,
  abilities = [],
}: {
  actors: ReportActor[]
  fight: ReportFight
  abilities?: Array<{
    gameID: number | null
    name: string | null
    icon: string | null
    type: string | null
  }>
}): Report {
  return {
    code: 'PROCESSORTEST',
    title: 'Processor Test',
    owner: { name: 'Owner' },
    guild: null,
    startTime: fight.startTime,
    endTime: fight.endTime,
    zone: { id: 1, name: 'Test Zone' },
    fights: [fight],
    masterData: {
      gameVersion: 2,
      actors,
      abilities,
    },
    rankings: {
      data: [],
    },
  }
}

function createPrepassContext({
  report,
  fight,
}: {
  report: Report
  fight: ReportFight
}): ProcessorBaseContext {
  const actorMap = new Map<number, Actor>(
    report.masterData.actors.map((actor) => [
      actor.id,
      {
        id: actor.id,
        name: actor.name,
        class: null,
        petOwner: actor.type === 'Pet' ? actor.petOwner : undefined,
      },
    ]),
  )

  return {
    namespace: createProcessorNamespace(),
    actorMap,
    friendlyActorIds: new Set([
      ...fight.friendlyPlayers,
      ...fight.friendlyPets.map((pet) => pet.id),
    ]),
    enemies: [],
    encounterId: fight.encounterID ?? null,
    config: createMockThreatConfig(),
    report,
    fight,
    inferThreatReduction: false,
    initialAurasByActor: new Map(),
  }
}

function expectGroupMembers(
  reportContext: ProcessorBaseContext,
  actorId: number,
): Set<number> {
  const assignments = reportContext.namespace.get(partyAssignmentsKey)
  expect(assignments).toBeDefined()
  const groupId = assignments?.actorGroupById.get(actorId)
  expect(groupId).toBeDefined()
  return new Set(assignments?.membersByGroupId.get(groupId!) ?? [])
}

describe('createPartyDetectionProcessor', () => {
  it('returns null when inferThreatReduction is disabled', () => {
    const fight = createFight(8, 1602, [1, 2])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'One', 'Warrior'),
        createPlayerActor(2, 'Two', 'Priest'),
      ],
      fight,
    })

    const processor = createPartyDetectionProcessor({
      report,
      fight,
      inferThreatReduction: false,
    })

    expect(processor).toBeNull()
  })

  it('infers party groups from party-wide buff and heal signals', () => {
    const fight = createFight(
      9,
      1602,
      [1, 2, 3, 4, 5, 6],
      [{ petId: 30, ownerId: 2 }],
    )
    const report = createReport({
      actors: [
        createPlayerActor(1, 'One', 'Warrior'),
        createPlayerActor(2, 'Two', 'Rogue'),
        createPlayerActor(3, 'Three', 'Priest'),
        createPlayerActor(4, 'Four', 'Warlock'),
        createPlayerActor(5, 'Five', 'Mage'),
        createPlayerActor(6, 'Six', 'Shaman'),
        createPetActor(30, 'Wolf', 2),
      ],
      fight,
    })
    const processor = createPartyDetectionProcessor({
      report,
      fight,
      inferThreatReduction: true,
    })
    expect(processor).not.toBeNull()
    if (!processor) {
      return
    }
    const context = createPrepassContext({
      report,
      fight,
    })

    runFightPrepass({
      rawEvents: [
        createHealEvent({
          timestamp: 1000,
          sourceID: 6,
          targetID: 1,
          abilityGameID: 25316,
        }),
        createHealEvent({
          timestamp: 1000,
          sourceID: 6,
          targetID: 2,
          abilityGameID: 25316,
        }),
        createHealEvent({
          timestamp: 1000,
          sourceID: 6,
          targetID: 3,
          abilityGameID: 25316,
        }),
        createApplyBuffEvent({
          timestamp: 4000,
          sourceID: 4,
          targetID: 4,
          abilityGameID: 25289,
        }),
        createApplyBuffEvent({
          timestamp: 4000,
          sourceID: 4,
          targetID: 5,
          abilityGameID: 25289,
        }),
      ],
      processors: [processor],
      baseContext: context,
    })

    const assignments = context.namespace.get(partyAssignmentsKey)
    expect(assignments).toBeDefined()
    expect(assignments?.actorGroupById.get(1)).toBe(
      assignments?.actorGroupById.get(2),
    )
    expect(assignments?.actorGroupById.get(1)).toBe(
      assignments?.actorGroupById.get(3),
    )
    expect(assignments?.actorGroupById.get(1)).toBe(
      assignments?.actorGroupById.get(30),
    )
    expect(assignments?.actorGroupById.get(1)).not.toBe(
      assignments?.actorGroupById.get(6),
    )
    expect(assignments?.actorGroupById.get(1)).not.toBe(
      assignments?.actorGroupById.get(4),
    )
    expect(assignments?.actorGroupById.get(4)).toBe(
      assignments?.actorGroupById.get(5),
    )
    expect(
      [...expectGroupMembers(context, 1)].sort((left, right) => left - right),
    ).toEqual([1, 2, 3, 30])
    expect(
      [...expectGroupMembers(context, 4)].sort((left, right) => left - right),
    ).toEqual([4, 5])
  })

  it('resolves party signals from report spell names when ids are not in fallback list', () => {
    const PRAYER_OF_HEALING_TEST_ID = 990_001
    const fight = createFight(11, 1602, [1, 2, 3])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'One', 'Warrior'),
        createPlayerActor(2, 'Two', 'Rogue'),
        createPlayerActor(3, 'Three', 'Priest'),
      ],
      fight,
      abilities: [
        {
          gameID: PRAYER_OF_HEALING_TEST_ID,
          name: 'Prayer of Healing (Rank 42)',
          icon: 'spell_nature_healingwavegreater.jpg',
          type: '8',
        },
      ],
    })
    const processor = createPartyDetectionProcessor({
      report,
      fight,
      inferThreatReduction: true,
    })
    expect(processor).not.toBeNull()
    if (!processor) {
      return
    }
    const context = createPrepassContext({
      report,
      fight,
    })

    runFightPrepass({
      rawEvents: [
        createHealEvent({
          timestamp: 1000,
          sourceID: 3,
          targetID: 1,
          abilityGameID: PRAYER_OF_HEALING_TEST_ID,
        }),
        createHealEvent({
          timestamp: 1000,
          sourceID: 3,
          targetID: 2,
          abilityGameID: PRAYER_OF_HEALING_TEST_ID,
        }),
      ],
      processors: [processor],
      baseContext: context,
    })

    const groupMembers = [...expectGroupMembers(context, 1)].sort(
      (left, right) => left - right,
    )
    const assignments = context.namespace.get(partyAssignmentsKey)
    expect(assignments).toBeDefined()
    expect(groupMembers).toEqual([1, 2])
  })

  it('does not infer groups from chain heal events', () => {
    const fight = createFight(12, 1602, [1, 2, 3])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'One', 'Warrior'),
        createPlayerActor(2, 'Two', 'Rogue'),
        createPlayerActor(3, 'Three', 'Shaman'),
      ],
      fight,
    })
    const processor = createPartyDetectionProcessor({
      report,
      fight,
      inferThreatReduction: true,
    })
    expect(processor).not.toBeNull()
    if (!processor) {
      return
    }
    const context = createPrepassContext({
      report,
      fight,
    })

    runFightPrepass({
      rawEvents: [
        createHealEvent({
          timestamp: 1000,
          sourceID: 3,
          targetID: 1,
          abilityGameID: 1064,
        }),
        createHealEvent({
          timestamp: 1000,
          sourceID: 3,
          targetID: 2,
          abilityGameID: 1064,
        }),
      ],
      processors: [processor],
      baseContext: context,
    })

    const assignments = context.namespace.get(partyAssignmentsKey)
    expect(assignments).toBeDefined()
    expect(assignments?.actorGroupById.get(1)).not.toBe(
      assignments?.actorGroupById.get(2),
    )
  })

  it('does not infer groups from vampiric embrace or vampiric touch events', () => {
    const fight = createFight(13, 1602, [1, 2, 3])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'One', 'Warrior'),
        createPlayerActor(2, 'Two', 'Rogue'),
        createPlayerActor(3, 'Three', 'Priest'),
      ],
      fight,
    })
    const processor = createPartyDetectionProcessor({
      report,
      fight,
      inferThreatReduction: true,
    })
    expect(processor).not.toBeNull()
    if (!processor) {
      return
    }
    const context = createPrepassContext({
      report,
      fight,
    })

    runFightPrepass({
      rawEvents: [
        createHealEvent({
          timestamp: 1000,
          sourceID: 3,
          targetID: 1,
          abilityGameID: 15290,
        }),
        createHealEvent({
          timestamp: 1000,
          sourceID: 3,
          targetID: 2,
          abilityGameID: 15290,
        }),
        createApplyBuffEvent({
          timestamp: 2000,
          sourceID: 3,
          targetID: 1,
          abilityGameID: 402779,
        }),
        createApplyBuffEvent({
          timestamp: 2000,
          sourceID: 3,
          targetID: 2,
          abilityGameID: 402779,
        }),
      ],
      processors: [processor],
      baseContext: context,
    })

    const assignments = context.namespace.get(partyAssignmentsKey)
    expect(assignments).toBeDefined()
    expect(assignments?.actorGroupById.get(1)).not.toBe(
      assignments?.actorGroupById.get(2),
    )
  })

  it('infers groups from Holy Nova heal targets', () => {
    const fight = createFight(14, 1602, [1, 2, 3, 4])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'One', 'Warrior'),
        createPlayerActor(2, 'Two', 'Warrior'),
        createPlayerActor(3, 'Three', 'Priest'),
        createPlayerActor(4, 'Four', 'Warrior'),
      ],
      fight,
    })
    const processor = createPartyDetectionProcessor({
      report,
      fight,
      inferThreatReduction: true,
    })
    expect(processor).not.toBeNull()
    if (!processor) {
      return
    }
    const context = createPrepassContext({
      report,
      fight,
    })

    runFightPrepass({
      rawEvents: [
        createHealEvent({
          timestamp: 1000,
          sourceID: 3,
          targetID: 1,
          abilityGameID: 25331,
        }),
        createHealEvent({
          timestamp: 1000,
          sourceID: 3,
          targetID: 2,
          abilityGameID: 25331,
        }),
        createHealEvent({
          timestamp: 2000,
          sourceID: 3,
          targetID: 4,
          abilityGameID: 27801,
        }),
      ],
      processors: [processor],
      baseContext: context,
    })

    const assignments = context.namespace.get(partyAssignmentsKey)
    expect(assignments).toBeDefined()
    expect(assignments?.actorGroupById.get(1)).toBe(
      assignments?.actorGroupById.get(2),
    )
    expect(assignments?.actorGroupById.get(1)).not.toBe(
      assignments?.actorGroupById.get(3),
    )
    expect(assignments?.actorGroupById.get(1)).not.toBe(
      assignments?.actorGroupById.get(4),
    )
  })

  it('infers groups from shaman and hunter party buff signals', () => {
    const fight = createFight(15, 1602, [1, 2, 3, 4, 5, 6])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'One', 'Warrior'),
        createPlayerActor(2, 'Two', 'Warrior'),
        createPlayerActor(3, 'Three', 'Warrior'),
        createPlayerActor(4, 'Four', 'Warrior'),
        createPlayerActor(5, 'Five', 'Shaman'),
        createPlayerActor(6, 'Six', 'Hunter'),
      ],
      fight,
    })
    const processor = createPartyDetectionProcessor({
      report,
      fight,
      inferThreatReduction: true,
    })
    expect(processor).not.toBeNull()
    if (!processor) {
      return
    }
    const context = createPrepassContext({
      report,
      fight,
    })

    runFightPrepass({
      rawEvents: [
        createApplyBuffEvent({
          timestamp: 1000,
          sourceID: 5,
          targetID: 1,
          abilityGameID: 30807,
        }),
        createApplyBuffEvent({
          timestamp: 1000,
          sourceID: 5,
          targetID: 2,
          abilityGameID: 30807,
        }),
        createApplyBuffEvent({
          timestamp: 2000,
          sourceID: 5,
          targetID: 1,
          abilityGameID: 32182,
        }),
        createApplyBuffEvent({
          timestamp: 2000,
          sourceID: 5,
          targetID: 2,
          abilityGameID: 32182,
        }),
        createApplyBuffEvent({
          timestamp: 3000,
          sourceID: 6,
          targetID: 3,
          abilityGameID: 27045,
        }),
        createApplyBuffEvent({
          timestamp: 3000,
          sourceID: 6,
          targetID: 4,
          abilityGameID: 27045,
        }),
        createApplyBuffEvent({
          timestamp: 4000,
          sourceID: 6,
          targetID: 3,
          abilityGameID: 13159,
        }),
        createApplyBuffEvent({
          timestamp: 4000,
          sourceID: 6,
          targetID: 4,
          abilityGameID: 13159,
        }),
      ],
      processors: [processor],
      baseContext: context,
    })

    const assignments = context.namespace.get(partyAssignmentsKey)
    expect(assignments).toBeDefined()

    expect(assignments?.actorGroupById.get(1)).toBe(
      assignments?.actorGroupById.get(2),
    )
    expect(assignments?.actorGroupById.get(3)).toBe(
      assignments?.actorGroupById.get(4),
    )
    expect(assignments?.actorGroupById.get(1)).not.toBe(
      assignments?.actorGroupById.get(3),
    )
    expect(assignments?.actorGroupById.get(1)).not.toBe(
      assignments?.actorGroupById.get(5),
    )
    expect(assignments?.actorGroupById.get(3)).not.toBe(
      assignments?.actorGroupById.get(6),
    )
  })

  it('enforces a hard five-player cap when connecting overlapping observations', () => {
    const fight = createFight(16, 1602, [1, 2, 3, 4, 5, 6, 7, 8])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'One', 'Warrior'),
        createPlayerActor(2, 'Two', 'Warrior'),
        createPlayerActor(3, 'Three', 'Warrior'),
        createPlayerActor(4, 'Four', 'Warrior'),
        createPlayerActor(5, 'Five', 'Warrior'),
        createPlayerActor(6, 'Six', 'Warrior'),
        createPlayerActor(7, 'Seven', 'Warrior'),
        createPlayerActor(8, 'Eight', 'Priest'),
      ],
      fight,
    })
    const processor = createPartyDetectionProcessor({
      report,
      fight,
      inferThreatReduction: true,
    })
    expect(processor).not.toBeNull()
    if (!processor) {
      return
    }
    const context = createPrepassContext({
      report,
      fight,
    })

    runFightPrepass({
      rawEvents: [
        createApplyBuffEvent({
          timestamp: 1000,
          sourceID: 8,
          targetID: 1,
          abilityGameID: 25289,
        }),
        createApplyBuffEvent({
          timestamp: 1000,
          sourceID: 8,
          targetID: 2,
          abilityGameID: 25289,
        }),
        createApplyBuffEvent({
          timestamp: 1000,
          sourceID: 8,
          targetID: 3,
          abilityGameID: 25289,
        }),
        createApplyBuffEvent({
          timestamp: 1000,
          sourceID: 8,
          targetID: 4,
          abilityGameID: 25289,
        }),
        createApplyBuffEvent({
          timestamp: 1000,
          sourceID: 8,
          targetID: 5,
          abilityGameID: 25289,
        }),
        createApplyBuffEvent({
          timestamp: 2000,
          sourceID: 8,
          targetID: 4,
          abilityGameID: 25289,
        }),
        createApplyBuffEvent({
          timestamp: 2000,
          sourceID: 8,
          targetID: 5,
          abilityGameID: 25289,
        }),
        createApplyBuffEvent({
          timestamp: 2000,
          sourceID: 8,
          targetID: 6,
          abilityGameID: 25289,
        }),
        createApplyBuffEvent({
          timestamp: 2000,
          sourceID: 8,
          targetID: 7,
          abilityGameID: 25289,
        }),
        createApplyBuffEvent({
          timestamp: 2000,
          sourceID: 8,
          targetID: 8,
          abilityGameID: 25289,
        }),
      ],
      processors: [processor],
      baseContext: context,
    })

    const assignments = context.namespace.get(partyAssignmentsKey)
    expect(assignments).toBeDefined()

    const groupOne = assignments?.actorGroupById.get(1)
    expect(groupOne).toBeDefined()
    expect(assignments?.actorGroupById.get(5)).toBe(groupOne)
    expect(assignments?.actorGroupById.get(6)).not.toBe(groupOne)
    expect(assignments?.actorGroupById.get(7)).not.toBe(groupOne)
    expect(assignments?.actorGroupById.get(8)).not.toBe(groupOne)
  })
})
