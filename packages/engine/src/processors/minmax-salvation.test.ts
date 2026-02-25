/**
 * Tests for minmax-salvation processor.
 */
import type {
  PlayerClass,
  Report,
  ReportActor,
  ReportEncounterRankingsEntry,
  ReportFight,
  ReportRankingsCharacter,
} from '@wow-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import {
  type ProcessorBaseContext,
  createProcessorNamespace,
  initialAuraAdditionsKey,
  mergeInitialAurasWithAdditions,
  runFightPrepass,
} from '../event-processors'
import { createMockThreatConfig } from '../test/helpers/config'
import { createMinmaxSalvationProcessor } from './minmax-salvation'

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

function createFight(
  id: number,
  encounterID: number,
  friendlyPlayers: number[],
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
    friendlyPets: [],
  }
}

function createReport({
  actors,
  fight,
  rankings,
}: {
  actors: ReportActor[]
  fight: ReportFight
  rankings: ReportEncounterRankingsEntry[]
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
      abilities: [],
    },
    rankings: {
      data: rankings,
    },
  }
}

function createPrepassContext({
  report,
  fight,
  inferThreatReduction,
  initialAurasByActor = new Map<number, readonly number[]>(),
}: {
  report: Report
  fight: ReportFight
  inferThreatReduction: boolean
  initialAurasByActor?: Map<number, readonly number[]>
}): ProcessorBaseContext {
  return {
    namespace: createProcessorNamespace(),
    actorMap: new Map(),
    friendlyActorIds: new Set(fight.friendlyPlayers),
    enemies: [],
    encounterId: fight.encounterID ?? null,
    config: createMockThreatConfig(),
    report,
    fight,
    inferThreatReduction,
    initialAurasByActor,
  }
}

describe('createMinmaxSalvationProcessor', () => {
  it('returns null when inferThreatReduction is disabled', () => {
    const fight = createFight(9, 1602, [1, 2])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'Tanky', 'Warrior'),
        createPlayerActor(2, 'Paladps', 'Paladin'),
      ],
      fight,
      rankings: [],
    })

    const processor = createMinmaxSalvationProcessor({
      report,
      fight,
      inferThreatReduction: false,
    })

    expect(processor).toBeNull()
  })

  it('returns null when no paladin exists in the fight', () => {
    const fight = createFight(9, 1602, [1, 2, 3])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'Tanky', 'Warrior'),
        createPlayerActor(2, 'Roguey', 'Rogue'),
        createPlayerActor(3, 'Priesty', 'Priest'),
      ],
      fight,
      rankings: [],
    })

    const processor = createMinmaxSalvationProcessor({
      report,
      fight,
      inferThreatReduction: true,
    })

    expect(processor).toBeNull()
  })

  it('applies baseline salvation only for non-tanks missing both salvation buffs', () => {
    const fight = createFight(11, 1602, [1, 2, 3, 4])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'Tanky', 'Warrior'),
        createPlayerActor(2, 'Roguey', 'Rogue'),
        createPlayerActor(3, 'Priesty', 'Priest'),
        createPlayerActor(4, 'Paladps', 'Paladin'),
      ],
      fight,
      rankings: [
        {
          encounter: { id: 1602, name: 'Test Encounter' },
          fightID: 11,
          roles: {
            tanks: {
              name: 'Tanks',
              characters: [{ id: 1, name: 'Tanky' } as ReportRankingsCharacter],
            },
          },
        } as ReportEncounterRankingsEntry,
      ],
    })
    const processor = createMinmaxSalvationProcessor({
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
      inferThreatReduction: true,
      initialAurasByActor: new Map([[2, [1038]]]),
    })
    context.namespace.set(
      initialAuraAdditionsKey,
      new Map([[3, new Set([1038])]]),
    )

    runFightPrepass({
      rawEvents: [],
      processors: [processor],
      baseContext: context,
    })

    const mergedInitialAurasByActor = mergeInitialAurasWithAdditions(
      context.initialAurasByActor,
      context.namespace.get(initialAuraAdditionsKey),
    )

    expect(mergedInitialAurasByActor.get(1)).toBeUndefined()
    expect(mergedInitialAurasByActor.get(2)).toEqual([1038])
    expect(mergedInitialAurasByActor.get(3)).toEqual([1038])
    expect(mergedInitialAurasByActor.get(4)).toEqual([25895])
  })

  it('resolves tank actor ids from ranking character names when ids are missing', () => {
    const fight = createFight(11, 1602, [1, 2, 3])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'Tanky', 'Warrior'),
        createPlayerActor(2, 'Roguey', 'Rogue'),
        createPlayerActor(3, 'Paladps', 'Paladin'),
      ],
      fight,
      rankings: [
        {
          encounter: { id: 1602, name: 'Test Encounter' },
          fightID: 11,
          roles: {
            tanks: {
              name: 'Tanks',
              characters: [{ name: 'Tanky' } as ReportRankingsCharacter],
            },
          },
        } as ReportEncounterRankingsEntry,
      ],
    })
    const processor = createMinmaxSalvationProcessor({
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
      inferThreatReduction: true,
    })

    runFightPrepass({
      rawEvents: [],
      processors: [processor],
      baseContext: context,
    })

    const mergedInitialAurasByActor = mergeInitialAurasWithAdditions(
      context.initialAurasByActor,
      context.namespace.get(initialAuraAdditionsKey),
    )

    expect(mergedInitialAurasByActor.get(1)).toBeUndefined()
    expect(mergedInitialAurasByActor.get(2)).toEqual([25895])
    expect(mergedInitialAurasByActor.get(3)).toEqual([25895])
  })

  it('skips salvation when a non-tank already has blessings equal to paladin count', () => {
    const blessingOfWisdomId = 25290
    const fight = createFight(18, 1602, [1, 2, 3])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'Tanky', 'Warrior'),
        createPlayerActor(2, 'Roguey', 'Rogue'),
        createPlayerActor(3, 'Palatank', 'Paladin'),
      ],
      fight,
      rankings: [
        {
          encounter: { id: 1602, name: 'Test Encounter' },
          fightID: 18,
          roles: {
            tanks: {
              name: 'Tanks',
              characters: [
                { id: 1, name: 'Tanky' } as ReportRankingsCharacter,
                { id: 3, name: 'Palatank' } as ReportRankingsCharacter,
              ],
            },
          },
        } as ReportEncounterRankingsEntry,
      ],
    })
    const processor = createMinmaxSalvationProcessor({
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
      inferThreatReduction: true,
      initialAurasByActor: new Map([[2, [blessingOfWisdomId]]]),
    })

    runFightPrepass({
      rawEvents: [],
      processors: [processor],
      baseContext: context,
    })

    const mergedInitialAurasByActor = mergeInitialAurasWithAdditions(
      context.initialAurasByActor,
      context.namespace.get(initialAuraAdditionsKey),
    )

    expect(mergedInitialAurasByActor.get(2)).toEqual([blessingOfWisdomId])
  })

  it('applies salvation when at least one paladin blessing slot is available', () => {
    const blessingOfWisdomId = 25290
    const fight = createFight(19, 1602, [1, 2, 3, 4])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'Tanky', 'Warrior'),
        createPlayerActor(2, 'Roguey', 'Rogue'),
        createPlayerActor(3, 'Palastar', 'Paladin'),
        createPlayerActor(4, 'Paladps', 'Paladin'),
      ],
      fight,
      rankings: [
        {
          encounter: { id: 1602, name: 'Test Encounter' },
          fightID: 19,
          roles: {
            tanks: {
              name: 'Tanks',
              characters: [{ id: 1, name: 'Tanky' } as ReportRankingsCharacter],
            },
          },
        } as ReportEncounterRankingsEntry,
      ],
    })
    const processor = createMinmaxSalvationProcessor({
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
      inferThreatReduction: true,
      initialAurasByActor: new Map([[2, [blessingOfWisdomId]]]),
    })

    runFightPrepass({
      rawEvents: [],
      processors: [processor],
      baseContext: context,
    })

    const mergedInitialAurasByActor = mergeInitialAurasWithAdditions(
      context.initialAurasByActor,
      context.namespace.get(initialAuraAdditionsKey),
    )

    expect(mergedInitialAurasByActor.get(2)).toEqual([
      blessingOfWisdomId,
      25895,
    ])
  })
})
