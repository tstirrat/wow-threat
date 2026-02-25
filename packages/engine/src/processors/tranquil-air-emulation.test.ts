/**
 * Tests for tranquil-air-emulation processor.
 */
import {
  createCastEvent,
  createDamageEvent,
  createHealEvent,
} from '@wow-threat/shared'
import type { Actor, ThreatConfig, ThreatContext } from '@wow-threat/shared'
import type {
  PlayerClass,
  Report,
  ReportActor,
  ReportFight,
  WCLEvent,
} from '@wow-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import { createMockThreatConfig } from '../test/helpers/config'
import { ThreatEngine } from '../threat-engine'
import { createPartyDetectionProcessor } from './party-detection'
import { createTranquilAirEmulationProcessor } from './tranquil-air-emulation'

const TRANQUIL_AIR_TOTEM_SPELL_ID = 25908
const TRANQUIL_AIR_BUFF_SPELL_ID = 25909

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

function createActorMap(): Map<number, Actor> {
  return new Map<number, Actor>([
    [1, { id: 1, name: 'One', class: 'warrior' }],
    [2, { id: 2, name: 'Two', class: 'warrior' }],
    [3, { id: 3, name: 'Three', class: 'warrior' }],
    [30, { id: 30, name: 'Priest', class: 'priest' }],
    [10, { id: 10, name: 'Shaman', class: 'shaman' }],
    [99, { id: 99, name: 'Boss', class: null }],
  ])
}

function createSummonEvent({
  timestamp,
  sourceID,
  abilityGameID,
  x,
  y,
}: {
  timestamp: number
  sourceID: number
  abilityGameID: number
  x?: number
  y?: number
}): WCLEvent {
  const baseEvent: WCLEvent = {
    timestamp,
    type: 'summon',
    sourceID,
    targetID: 9000 + timestamp,
    abilityGameID,
  }

  if (typeof x === 'number' && typeof y === 'number') {
    return {
      ...baseEvent,
      x,
      y,
    }
  }

  return baseEvent
}

function createTotemCastEvent({
  timestamp,
  sourceID,
  x,
  y,
}: {
  timestamp: number
  sourceID: number
  x: number
  y: number
}): WCLEvent {
  return createCastEvent({
    timestamp,
    sourceID,
    targetID: -1,
    abilityGameID: TRANQUIL_AIR_TOTEM_SPELL_ID,
    x,
    y,
  })
}

function createTranquilAirConfig(): ThreatConfig {
  return createMockThreatConfig({
    baseThreat: {
      damage: (ctx: ThreatContext) => ({
        formula: 'amount',
        value: ctx.amount,
        splitAmongEnemies: false,
      }),
      absorbed: () => ({
        formula: '0',
        value: 0,
        splitAmongEnemies: false,
      }),
      heal: () => ({
        formula: '0',
        value: 0,
        splitAmongEnemies: false,
      }),
      energize: () => ({
        formula: '0',
        value: 0,
        splitAmongEnemies: false,
      }),
    },
    classes: {
      warrior: {
        baseThreatFactor: 1,
        auraModifiers: {},
        abilities: {},
      },
      shaman: {
        baseThreatFactor: 1,
        auraModifiers: {
          [TRANQUIL_AIR_BUFF_SPELL_ID]: () => ({
            source: 'aura',
            name: 'Tranquil Air Totem',
            value: 0.8,
          }),
        },
        abilities: {},
      },
    },
  })
}

function createEngine(): ThreatEngine {
  return new ThreatEngine({
    processorFactories: [
      createPartyDetectionProcessor,
      createTranquilAirEmulationProcessor,
    ],
  })
}

describe('createTranquilAirEmulationProcessor', () => {
  it('does not emulate tranquil air when inferThreatReduction is disabled', () => {
    const fight = createFight(8, 1602, [1, 2, 10])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'One', 'Warrior'),
        createPlayerActor(2, 'Two', 'Warrior'),
        createPlayerActor(10, 'Shaman', 'Shaman'),
      ],
      fight,
    })
    const result = createEngine().processEvents({
      rawEvents: [
        createHealEvent({
          timestamp: 1000,
          sourceID: 10,
          targetID: 1,
          abilityGameID: 25316,
          x: 1000,
          y: 0,
        }),
        createHealEvent({
          timestamp: 1000,
          sourceID: 10,
          targetID: 2,
          abilityGameID: 25316,
          x: 1000,
          y: 0,
        }),
        createHealEvent({
          timestamp: 1000,
          sourceID: 10,
          targetID: 10,
          abilityGameID: 25316,
          x: 1000,
          y: 0,
        }),
        createTotemCastEvent({
          timestamp: 1099,
          sourceID: 10,
          x: 0,
          y: 0,
        }),
        createSummonEvent({
          timestamp: 1100,
          sourceID: 10,
          abilityGameID: TRANQUIL_AIR_TOTEM_SPELL_ID,
        }),
        createDamageEvent({
          timestamp: 1200,
          sourceID: 2,
          targetID: 99,
          amount: 100,
        }),
      ],
      actorMap: createActorMap(),
      friendlyActorIds: new Set([1, 2, 10]),
      enemies: [{ id: 99, name: 'Boss', instance: 0 }],
      report,
      fight,
      inferThreatReduction: false,
      config: createTranquilAirConfig(),
    })

    const partyDamageEvent = result.augmentedEvents.find(
      (event) => event.type === 'damage' && event.sourceID === 2,
    )
    expect(partyDamageEvent?.threat?.calculation.modifiedThreat).toBe(100)
  })

  it('applies Tranquil Air aura to in-range members of the inferred shaman party', () => {
    const fight = createFight(9, 1602, [1, 2, 3, 10])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'One', 'Warrior'),
        createPlayerActor(2, 'Two', 'Warrior'),
        createPlayerActor(3, 'Three', 'Warrior'),
        createPlayerActor(10, 'Shaman', 'Shaman'),
      ],
      fight,
    })
    const result = createEngine().processEvents({
      rawEvents: [
        createHealEvent({
          timestamp: 1000,
          sourceID: 10,
          targetID: 1,
          abilityGameID: 25316,
          x: 1000,
          y: 0,
        }),
        createHealEvent({
          timestamp: 1000,
          sourceID: 10,
          targetID: 2,
          abilityGameID: 25316,
          x: 5800,
          y: 0,
        }),
        createHealEvent({
          timestamp: 1000,
          sourceID: 10,
          targetID: 10,
          abilityGameID: 25316,
          x: 100,
          y: 0,
        }),
        createHealEvent({
          timestamp: 1001,
          sourceID: 10,
          targetID: 3,
          abilityGameID: 8004,
          x: 9000,
          y: 0,
        }),
        createTotemCastEvent({
          timestamp: 1199,
          sourceID: 10,
          x: 0,
          y: 0,
        }),
        createSummonEvent({
          timestamp: 1200,
          sourceID: 10,
          abilityGameID: TRANQUIL_AIR_TOTEM_SPELL_ID,
        }),
        createDamageEvent({
          timestamp: 1300,
          sourceID: 1,
          targetID: 99,
          amount: 100,
        }),
        createDamageEvent({
          timestamp: 1301,
          sourceID: 2,
          targetID: 99,
          amount: 100,
        }),
        createDamageEvent({
          timestamp: 1302,
          sourceID: 3,
          targetID: 99,
          amount: 100,
        }),
      ],
      actorMap: createActorMap(),
      friendlyActorIds: new Set([1, 2, 3, 10]),
      enemies: [{ id: 99, name: 'Boss', instance: 0 }],
      report,
      fight,
      inferThreatReduction: true,
      config: createTranquilAirConfig(),
    })

    const damageBySourceId = new Map(
      result.augmentedEvents
        .filter((event) => event.type === 'damage')
        .map((event) => [event.sourceID, event]),
    )

    expect(damageBySourceId.get(1)?.threat?.calculation.modifiedThreat).toBe(80)
    expect(damageBySourceId.get(2)?.threat?.calculation.modifiedThreat).toBe(80)
    expect(damageBySourceId.get(3)?.threat?.calculation.modifiedThreat).toBe(
      100,
    )
  })

  it('removes Tranquil Air aura from party members who are out of range on a new summon', () => {
    const fight = createFight(11, 1602, [1, 2, 10])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'One', 'Warrior'),
        createPlayerActor(2, 'Two', 'Warrior'),
        createPlayerActor(10, 'Shaman', 'Shaman'),
      ],
      fight,
    })
    const result = createEngine().processEvents({
      rawEvents: [
        createHealEvent({
          timestamp: 1000,
          sourceID: 10,
          targetID: 1,
          abilityGameID: 25316,
          x: 1000,
          y: 0,
        }),
        createHealEvent({
          timestamp: 1000,
          sourceID: 10,
          targetID: 2,
          abilityGameID: 25316,
          x: 5800,
          y: 0,
        }),
        createHealEvent({
          timestamp: 1000,
          sourceID: 10,
          targetID: 10,
          abilityGameID: 25316,
          x: 100,
          y: 0,
        }),
        createTotemCastEvent({
          timestamp: 1099,
          sourceID: 10,
          x: 0,
          y: 0,
        }),
        createSummonEvent({
          timestamp: 1100,
          sourceID: 10,
          abilityGameID: TRANQUIL_AIR_TOTEM_SPELL_ID,
        }),
        createDamageEvent({
          timestamp: 1200,
          sourceID: 2,
          targetID: 99,
          amount: 100,
        }),
        createHealEvent({
          timestamp: 1300,
          sourceID: 10,
          targetID: 2,
          abilityGameID: 8004,
          x: 9000,
          y: 0,
        }),
        createTotemCastEvent({
          timestamp: 1399,
          sourceID: 10,
          x: 0,
          y: 0,
        }),
        createSummonEvent({
          timestamp: 1400,
          sourceID: 10,
          abilityGameID: TRANQUIL_AIR_TOTEM_SPELL_ID,
        }),
        createDamageEvent({
          timestamp: 1500,
          sourceID: 2,
          targetID: 99,
          amount: 100,
        }),
      ],
      actorMap: createActorMap(),
      friendlyActorIds: new Set([1, 2, 10]),
      enemies: [{ id: 99, name: 'Boss', instance: 0 }],
      report,
      fight,
      inferThreatReduction: true,
      config: createTranquilAirConfig(),
    })

    const damageEventsBySourceTwo = result.augmentedEvents.filter(
      (event) => event.type === 'damage' && event.sourceID === 2,
    )

    expect(damageEventsBySourceTwo[0]?.threat?.calculation.modifiedThreat).toBe(
      80,
    )
    expect(damageEventsBySourceTwo[1]?.threat?.calculation.modifiedThreat).toBe(
      100,
    )
  })

  it('uses Tranquil Air cast position instead of summon event coordinates', () => {
    const fight = createFight(12, 1602, [1, 2, 10])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'One', 'Warrior'),
        createPlayerActor(2, 'Two', 'Warrior'),
        createPlayerActor(10, 'Shaman', 'Shaman'),
      ],
      fight,
    })
    const result = createEngine().processEvents({
      rawEvents: [
        createHealEvent({
          timestamp: 1000,
          sourceID: 10,
          targetID: 1,
          abilityGameID: 25316,
          x: 1000,
          y: 0,
        }),
        createHealEvent({
          timestamp: 1000,
          sourceID: 10,
          targetID: 2,
          abilityGameID: 25316,
          x: 6500,
          y: 0,
        }),
        createHealEvent({
          timestamp: 1000,
          sourceID: 10,
          targetID: 10,
          abilityGameID: 25316,
          x: 6000,
          y: 0,
        }),
        createTotemCastEvent({
          timestamp: 1099,
          sourceID: 10,
          x: 6000,
          y: 0,
        }),
        createSummonEvent({
          timestamp: 1100,
          sourceID: 10,
          abilityGameID: TRANQUIL_AIR_TOTEM_SPELL_ID,
          x: 0,
          y: 0,
        }),
        createDamageEvent({
          timestamp: 1200,
          sourceID: 2,
          targetID: 99,
          amount: 100,
        }),
      ],
      actorMap: createActorMap(),
      friendlyActorIds: new Set([1, 2, 10]),
      enemies: [{ id: 99, name: 'Boss', instance: 0 }],
      report,
      fight,
      inferThreatReduction: true,
      config: createTranquilAirConfig(),
    })

    const partyDamageEvent = result.augmentedEvents.find(
      (event) => event.type === 'damage' && event.sourceID === 2,
    )
    expect(partyDamageEvent?.threat?.calculation.modifiedThreat).toBe(80)
  })

  it('does not apply to players outside the shaman inferred membership group', () => {
    const fight = createFight(13, 1602, [1, 10, 30])
    const report = createReport({
      actors: [
        createPlayerActor(1, 'One', 'Warrior'),
        createPlayerActor(10, 'Shaman', 'Shaman'),
        createPlayerActor(30, 'Priest', 'Priest'),
      ],
      fight,
    })
    const result = createEngine().processEvents({
      rawEvents: [
        createHealEvent({
          timestamp: 1000,
          sourceID: 30,
          targetID: 1,
          abilityGameID: 25316,
          x: 1000,
          y: 0,
        }),
        createHealEvent({
          timestamp: 1000,
          sourceID: 30,
          targetID: 30,
          abilityGameID: 25316,
          x: 1000,
          y: 0,
        }),
        createTotemCastEvent({
          timestamp: 1099,
          sourceID: 10,
          x: 0,
          y: 0,
        }),
        createSummonEvent({
          timestamp: 1100,
          sourceID: 10,
          abilityGameID: TRANQUIL_AIR_TOTEM_SPELL_ID,
        }),
        createDamageEvent({
          timestamp: 1200,
          sourceID: 1,
          targetID: 99,
          amount: 100,
        }),
      ],
      actorMap: createActorMap(),
      friendlyActorIds: new Set([1, 10, 30]),
      enemies: [{ id: 99, name: 'Boss', instance: 0 }],
      report,
      fight,
      inferThreatReduction: true,
      config: createTranquilAirConfig(),
    })

    const warriorDamageEvent = result.augmentedEvents.find(
      (event) => event.type === 'damage' && event.sourceID === 1,
    )
    expect(warriorDamageEvent?.threat?.calculation.modifiedThreat).toBe(100)
  })
})
