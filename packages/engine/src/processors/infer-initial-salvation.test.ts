/**
 * Tests for infer-initial-salvation processor.
 */
import {
  createApplyBuffEvent,
  createCombatantInfoAura,
  createCombatantInfoEvent,
  createRefreshBuffEvent,
  createRemoveBuffEvent,
} from '@wow-threat/shared'
import type {
  PlayerClass,
  Report,
  ReportActor,
  ReportFight,
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
import { createInferInitialSalvationProcessor } from './infer-initial-salvation'
import { salvationInferenceMetadataKey } from './keys'

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
}: {
  actors: ReportActor[]
  fight: ReportFight
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
      data: [],
    },
  }
}

function createPrepassContext({
  report,
  fight,
  initialAurasByActor = new Map<number, readonly number[]>(),
}: {
  report: Report
  fight: ReportFight
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
    inferThreatReduction: false,
    initialAurasByActor,
  }
}

describe('createInferInitialSalvationProcessor', () => {
  it('returns null when fight has no friendly players', () => {
    const fight = createFight(9, 1602, [])
    const report = createReport({
      actors: [createPlayerActor(1, 'Tanky', 'Warrior')],
      fight,
    })

    const processor = createInferInitialSalvationProcessor({
      report,
      fight,
      inferThreatReduction: false,
    })

    expect(processor).toBeNull()
  })

  it('infers initial salvation from first remove/refresh events and stores metadata', () => {
    const fight = createFight(9, 1602, [1, 2, 3])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'Tanky', 'Warrior'),
        createPlayerActor(2, 'Roguey', 'Rogue'),
        createPlayerActor(3, 'Priesty', 'Priest'),
      ],
      fight,
    })
    const processor = createInferInitialSalvationProcessor({
      report,
      fight,
      inferThreatReduction: false,
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
        createCombatantInfoEvent({
          sourceID: 2,
          auras: [createCombatantInfoAura(1038, 'Blessing of Salvation')],
        }),
        createRemoveBuffEvent({
          timestamp: 1500,
          sourceID: 1,
          targetID: 2,
          abilityGameID: 1038,
        }),
        createRefreshBuffEvent({
          timestamp: 1600,
          sourceID: 1,
          targetID: 3,
          abilityGameID: 25895,
        }),
      ],
      processors: [processor],
      baseContext: context,
    })

    const mergedInitialAurasByActor = mergeInitialAurasWithAdditions(
      context.initialAurasByActor,
      context.namespace.get(initialAuraAdditionsKey),
    )
    const metadata = context.namespace.get(salvationInferenceMetadataKey)

    expect(mergedInitialAurasByActor.get(2)).toEqual([1038])
    expect(mergedInitialAurasByActor.get(3)).toEqual([25895])
    expect(metadata?.combatantInfoMinorSalvationPlayerIds).toEqual(new Set([2]))
    expect(metadata?.minorSalvationRemovedPlayerIds).toEqual(new Set([2]))
  })

  it('does not infer when apply exists before remove/refresh', () => {
    const fight = createFight(9, 1602, [1, 2, 3])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'Tanky', 'Warrior'),
        createPlayerActor(2, 'Roguey', 'Rogue'),
        createPlayerActor(3, 'Priesty', 'Priest'),
      ],
      fight,
    })
    const processor = createInferInitialSalvationProcessor({
      report,
      fight,
      inferThreatReduction: false,
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
          timestamp: 1100,
          sourceID: 1,
          targetID: 2,
          abilityGameID: 1038,
        }),
        createRemoveBuffEvent({
          timestamp: 1200,
          sourceID: 1,
          targetID: 2,
          abilityGameID: 1038,
        }),
        createApplyBuffEvent({
          timestamp: 1300,
          sourceID: 1,
          targetID: 3,
          abilityGameID: 25895,
        }),
        createRefreshBuffEvent({
          timestamp: 1400,
          sourceID: 1,
          targetID: 3,
          abilityGameID: 25895,
        }),
      ],
      processors: [processor],
      baseContext: context,
    })

    const mergedInitialAurasByActor = mergeInitialAurasWithAdditions(
      context.initialAurasByActor,
      context.namespace.get(initialAuraAdditionsKey),
    )

    expect(mergedInitialAurasByActor.get(2)).toBeUndefined()
    expect(mergedInitialAurasByActor.get(3)).toBeUndefined()
  })
})
