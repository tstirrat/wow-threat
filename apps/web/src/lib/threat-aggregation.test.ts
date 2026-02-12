/**
 * Unit tests for threat aggregation helpers.
 */
import { describe, expect, it } from 'vitest'

import { getClassColor } from './class-colors'
import {
  buildThreatSeries,
  buildFocusedPlayerSummary,
  buildFocusedPlayerThreatRows,
  filterSeriesByPlayers,
  selectDefaultTargetId,
} from './threat-aggregation'
import type { ReportAbilitySummary, ReportActorSummary } from '../types/api'
import type { ThreatSeries } from '../types/app'

describe('threat-aggregation', () => {
  it('selects target with highest accumulated threat', () => {
    const events = [
      {
        threat: {
          changes: [
            {
              sourceId: 1,
              targetId: 10,
              targetInstance: 0,
              operator: 'add',
              amount: 100,
              total: 100,
            },
          ],
        },
      },
      {
        threat: {
          changes: [
            {
              sourceId: 1,
              targetId: 20,
              targetInstance: 0,
              operator: 'add',
              amount: 200,
              total: 200,
            },
          ],
        },
      },
    ] as Array<{
      threat: {
        changes: Array<{
          sourceId: number
          targetId: number
          targetInstance: number
          operator: 'add' | 'set'
          amount: number
          total: number
        }>
      }
    }>

    expect(selectDefaultTargetId(events as never, new Set([10, 20]))).toBe(20)
  })

  it('filters pet lines by owner when player filter is applied', () => {
    const series: ThreatSeries[] = [
      {
        actorId: 1,
        actorName: 'Warrior',
        actorClass: 'Warrior',
        actorType: 'Player',
        ownerId: null,
        label: 'Warrior',
        color: '#fff',
        points: [],
        maxThreat: 0,
        totalThreat: 0,
        totalDamage: 0,
        totalHealing: 0,
        stateVisualSegments: [],
        fixateWindows: [],
        invulnerabilityWindows: [],
      },
      {
        actorId: 5,
        actorName: 'Pet',
        actorClass: 'Hunter',
        actorType: 'Pet',
        ownerId: 2,
        label: 'Pet (Hunter)',
        color: '#fff',
        points: [],
        maxThreat: 0,
        totalThreat: 0,
        totalDamage: 0,
        totalHealing: 0,
        stateVisualSegments: [],
        fixateWindows: [],
        invulnerabilityWindows: [],
      },
    ]

    const filtered = filterSeriesByPlayers(series, [2])
    expect(filtered.map((entry) => entry.actorId)).toEqual([5])
  })

  it('builds state visual segments and fixate windows for the selected target', () => {
    const actors: ReportActorSummary[] = [
      {
        id: 1,
        name: 'Warrior',
        type: 'Player',
        subType: 'Warrior',
      },
    ]
    const abilities: ReportAbilitySummary[] = [
      {
        gameID: 100,
        icon: null,
        name: 'Sunder Armor',
        type: 'ability',
      },
    ]
    const buildCalculation = (effects?: unknown[]) => ({
      formula: '0',
      amount: 0,
      baseThreat: 0,
      modifiedThreat: 0,
      isSplit: false,
      modifiers: [],
      effects,
    })
    const events = [
      {
        timestamp: 1000,
        type: 'damage',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 10,
        targetIsFriendly: false,
        abilityGameID: 100,
        amount: 200,
        threat: {
          changes: [
            {
              sourceId: 1,
              targetId: 10,
              targetInstance: 0,
              operator: 'add',
              amount: 100,
              total: 100,
            },
          ],
          calculation: {
            formula: 'damage',
            amount: 200,
            baseThreat: 200,
            modifiedThreat: 100,
            isSplit: false,
            modifiers: [],
          },
        },
      },
      {
        timestamp: 1080,
        type: 'removebuff',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 1,
        targetIsFriendly: true,
        threat: {
          changes: [],
          calculation: buildCalculation([
            {
              type: 'state',
              state: {
                kind: 'fixate',
                phase: 'end',
                spellId: 355,
                actorId: 1,
                targetId: 10,
              },
            },
          ]),
        },
      },
      {
        timestamp: 1100,
        type: 'applybuff',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 1,
        targetIsFriendly: true,
        threat: {
          changes: [],
          calculation: buildCalculation([
            {
              type: 'state',
              state: {
                kind: 'fixate',
                phase: 'start',
                spellId: 355,
                actorId: 1,
                targetId: 10,
              },
            },
          ]),
        },
      },
      {
        timestamp: 1150,
        type: 'applybuff',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 1,
        targetIsFriendly: true,
        threat: {
          changes: [],
          calculation: buildCalculation([
            {
              type: 'state',
              state: {
                kind: 'invulnerable',
                phase: 'start',
                spellId: 642,
                actorId: 1,
              },
            },
          ]),
        },
      },
      {
        timestamp: 1175,
        type: 'applybuff',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 1,
        targetIsFriendly: true,
        threat: {
          changes: [],
          calculation: buildCalculation([
            {
              type: 'state',
              state: {
                kind: 'aggroLoss',
                phase: 'start',
                spellId: 118,
                actorId: 1,
              },
            },
          ]),
        },
      },
      {
        timestamp: 1200,
        type: 'removebuff',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 1,
        targetIsFriendly: true,
        threat: {
          changes: [],
          calculation: buildCalculation([
            {
              type: 'state',
              state: {
                kind: 'invulnerable',
                phase: 'end',
                spellId: 642,
                actorId: 1,
              },
            },
          ]),
        },
      },
      {
        timestamp: 1225,
        type: 'removebuff',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 1,
        targetIsFriendly: true,
        threat: {
          changes: [],
          calculation: buildCalculation([
            {
              type: 'state',
              state: {
                kind: 'aggroLoss',
                phase: 'end',
                spellId: 118,
                actorId: 1,
              },
            },
          ]),
        },
      },
      {
        timestamp: 1250,
        type: 'removebuff',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 1,
        targetIsFriendly: true,
        threat: {
          changes: [],
          calculation: buildCalculation([
            {
              type: 'state',
              state: {
                kind: 'fixate',
                phase: 'end',
                spellId: 355,
                actorId: 1,
                targetId: 10,
              },
            },
          ]),
        },
      },
      {
        timestamp: 1300,
        type: 'applybuff',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 1,
        targetIsFriendly: true,
        threat: {
          changes: [],
          calculation: buildCalculation([
            {
              type: 'state',
              state: {
                kind: 'aggroLoss',
                phase: 'start',
                spellId: 10346,
                actorId: 1,
              },
            },
          ]),
        },
      },
      {
        timestamp: 1325,
        type: 'applybuff',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 1,
        targetIsFriendly: true,
        threat: {
          changes: [],
          calculation: buildCalculation([
            {
              type: 'state',
              state: {
                kind: 'fixate',
                phase: 'start',
                spellId: 355,
                actorId: 1,
                targetId: 20,
              },
            },
          ]),
        },
      },
      {
        timestamp: 1350,
        type: 'removebuff',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 1,
        targetIsFriendly: true,
        threat: {
          changes: [],
          calculation: buildCalculation([
            {
              type: 'state',
              state: {
                kind: 'fixate',
                phase: 'end',
                spellId: 355,
                actorId: 1,
                targetId: 20,
              },
            },
          ]),
        },
      },
    ]

    const series = buildThreatSeries({
      events: events as never,
      actors,
      abilities,
      fightStartTime: 1000,
      fightEndTime: 1500,
      targetId: 10,
    })

    expect(series).toHaveLength(1)
    expect(series[0]?.stateVisualSegments).toEqual([
      { kind: 'fixate', startMs: 100, endMs: 150 },
      { kind: 'invulnerable', startMs: 150, endMs: 175 },
      { kind: 'aggroLoss', startMs: 175, endMs: 225 },
      { kind: 'fixate', startMs: 225, endMs: 250 },
      { kind: 'aggroLoss', startMs: 300, endMs: 500 },
    ])
    expect(series[0]?.fixateWindows).toEqual([{ startMs: 100, endMs: 250 }])
    expect(series[0]?.invulnerabilityWindows).toEqual([
      { startMs: 150, endMs: 200 },
    ])
  })

  it('builds focused player summary for the selected window', () => {
    const actors: ReportActorSummary[] = [
      {
        id: 1,
        name: 'Warrior',
        type: 'Player',
        subType: 'Warrior',
      },
      {
        id: 5,
        name: 'Pet',
        type: 'Pet',
        petOwner: 1,
      },
    ]
    const events = [
      {
        timestamp: 1000,
        type: 'damage',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 10,
        targetIsFriendly: false,
        amount: 300,
        threat: {
          changes: [
            {
              sourceId: 1,
              targetId: 10,
              targetInstance: 0,
              operator: 'add',
              amount: 150,
              total: 150,
            },
          ],
          calculation: {
            formula: 'damage',
            amount: 300,
            baseThreat: 300,
            modifiedThreat: 150,
            isSplit: false,
            modifiers: [],
          },
        },
      },
      {
        timestamp: 1500,
        type: 'damage',
        sourceID: 5,
        sourceIsFriendly: true,
        targetID: 10,
        targetIsFriendly: false,
        amount: 100,
        threat: {
          changes: [
            {
              sourceId: 5,
              targetId: 10,
              targetInstance: 0,
              operator: 'add',
              amount: 50,
              total: 50,
            },
          ],
          calculation: {
            formula: 'damage',
            amount: 100,
            baseThreat: 100,
            modifiedThreat: 50,
            isSplit: false,
            modifiers: [],
          },
        },
      },
      {
        timestamp: 3000,
        type: 'heal',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 1,
        targetIsFriendly: true,
        amount: 200,
        threat: {
          changes: [
            {
              sourceId: 1,
              targetId: 10,
              targetInstance: 0,
              operator: 'add',
              amount: 100,
              total: 250,
            },
          ],
          calculation: {
            formula: 'heal',
            amount: 200,
            baseThreat: 200,
            modifiedThreat: 100,
            isSplit: false,
            modifiers: [],
          },
        },
      },
    ]

    expect(
      buildFocusedPlayerSummary({
        events: events as never,
        actors,
        fightStartTime: 1000,
        targetId: 10,
        focusedPlayerId: 1,
        windowStartMs: 0,
        windowEndMs: 1500,
      }),
    ).toEqual({
      actorId: 1,
      label: 'Warrior',
      actorClass: 'Warrior',
      totalThreat: 200,
      totalTps: 133.33333333333334,
      totalDamage: 400,
      totalHealing: 0,
      color: getClassColor('Warrior'),
    })
  })

  it('builds focused player threat rows for the selected window', () => {
    const actors: ReportActorSummary[] = [
      {
        id: 1,
        name: 'Warrior',
        type: 'Player',
        subType: 'Warrior',
      },
      {
        id: 5,
        name: 'Wolf',
        type: 'Pet',
        petOwner: 1,
      },
    ]
    const abilities: ReportAbilitySummary[] = [
      {
        gameID: 100,
        icon: null,
        name: 'Shield Slam',
        type: 'ability',
      },
      {
        gameID: 200,
        icon: null,
        name: 'Bite',
        type: 'ability',
      },
    ]
    const events = [
      {
        timestamp: 1000,
        type: 'damage',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 10,
        targetIsFriendly: false,
        abilityGameID: 100,
        amount: 300,
        threat: {
          changes: [
            {
              sourceId: 1,
              targetId: 10,
              targetInstance: 0,
              operator: 'add',
              amount: 150,
              total: 150,
            },
          ],
          calculation: {
            formula: 'damage',
            amount: 300,
            baseThreat: 300,
            modifiedThreat: 150,
            isSplit: false,
            modifiers: [],
          },
        },
      },
      {
        timestamp: 1500,
        type: 'damage',
        sourceID: 5,
        sourceIsFriendly: true,
        targetID: 10,
        targetIsFriendly: false,
        abilityGameID: 200,
        amount: 100,
        threat: {
          changes: [
            {
              sourceId: 5,
              targetId: 10,
              targetInstance: 0,
              operator: 'add',
              amount: 50,
              total: 50,
            },
          ],
          calculation: {
            formula: 'damage',
            amount: 100,
            baseThreat: 100,
            modifiedThreat: 50,
            isSplit: false,
            modifiers: [],
          },
        },
      },
      {
        timestamp: 3000,
        type: 'damage',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 10,
        targetIsFriendly: false,
        abilityGameID: 100,
        amount: 200,
        threat: {
          changes: [
            {
              sourceId: 1,
              targetId: 10,
              targetInstance: 0,
              operator: 'add',
              amount: 100,
              total: 250,
            },
          ],
          calculation: {
            formula: 'damage',
            amount: 200,
            baseThreat: 200,
            modifiedThreat: 100,
            isSplit: false,
            modifiers: [],
          },
        },
      },
    ]

    const rows = buildFocusedPlayerThreatRows({
      events: events as never,
      actors,
      abilities,
      fightStartTime: 1000,
      targetId: 10,
      focusedPlayerId: 1,
      windowStartMs: 0,
      windowEndMs: 1000,
    })

    expect(rows).toEqual([
      {
        key: '100',
        abilityId: 100,
        abilityName: 'Shield Slam',
        amount: 300,
        threat: 150,
        tps: 150,
      },
      {
        key: '200',
        abilityId: 200,
        abilityName: 'Bite',
        amount: 100,
        threat: 50,
        tps: 50,
      },
    ])
  })
})
