/**
 * WCL Input Builders Tests
 */
import type { ReportActor, ReportFight } from '@wow-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import { buildThreatEngineInput } from './wcl-input'

describe('buildThreatEngineInput', () => {
  it('propagates enemy gameID from fight metadata', () => {
    const actors: ReportActor[] = [
      {
        id: 1,
        name: 'Tank',
        type: 'Player',
        subType: 'Warrior',
      },
      {
        id: 78,
        name: 'High Priestess Arlokk',
        type: 'NPC',
        subType: 'Boss',
      },
    ]
    const fight: ReportFight = {
      id: 18,
      encounterID: 150791,
      name: 'High Priestess Arlokk',
      startTime: 0,
      endTime: 1000,
      kill: true,
      difficulty: 3,
      bossPercentage: 0.01,
      fightPercentage: 0.01,
      enemyNPCs: [
        {
          id: 78,
          gameID: 14515,
          instanceCount: 1,
          groupCount: 2,
          petOwner: null,
        },
      ],
      enemyPets: [],
      friendlyPlayers: [1],
      friendlyPets: [],
    }

    const { enemies } = buildThreatEngineInput({
      fight,
      actors,
      abilities: [],
    })

    expect(enemies).toContainEqual(
      expect.objectContaining({
        id: 78,
        instance: 0,
        gameID: 14515,
      }),
    )
  })

  it('builds enemy instances from fight metadata without event scanning', () => {
    const actors: ReportActor[] = [
      {
        id: 1,
        name: 'Tank',
        type: 'Player',
        subType: 'Warrior',
      },
      {
        id: 500,
        name: 'Spawned Add',
        type: 'NPC',
        subType: 'NPC',
      },
    ]
    const fight: ReportFight = {
      id: 99,
      encounterID: 123456,
      name: 'Synthetic Encounter',
      startTime: 0,
      endTime: 1000,
      kill: true,
      difficulty: 3,
      bossPercentage: 0,
      fightPercentage: 0,
      enemyNPCs: [
        {
          id: 500,
          gameID: 9001,
          instanceCount: 3,
          groupCount: 1,
          petOwner: null,
        },
      ],
      enemyPets: [],
      friendlyPlayers: [1],
      friendlyPets: [],
    }

    const { enemies } = buildThreatEngineInput({
      fight,
      actors,
      abilities: [],
    })

    expect(
      enemies
        .filter((enemy) => enemy.id === 500)
        .map((enemy) => enemy.instance),
    ).toEqual([0, 1, 2])
  })
})
