/**
 * Unit tests for threat aggregation helpers.
 */
import { ResourceTypeCode } from '@wow-threat/wcl-types'
import { describe, expect, it } from 'vitest'

import type { ReportAbilitySummary, ReportActorSummary } from '../types/api'
import type { ThreatSeries } from '../types/app'
import { getClassColor } from './class-colors'
import {
  buildFightTargetOptions,
  buildFocusedPlayerSummary,
  buildFocusedPlayerThreatRows,
  buildInitialAurasDisplay,
  buildThreatSeries,
  filterSeriesByPlayers,
  getInitialAuras,
  getNotableAuraIds,
  selectDefaultTarget,
} from './threat-aggregation'

describe('threat-aggregation', () => {
  it('selects target instance with highest accumulated threat', () => {
    const events = [
      {
        threat: {
          changes: [
            {
              sourceId: 1,
              targetId: 10,
              targetInstance: 1,
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
              targetId: 10,
              targetInstance: 2,
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

    expect(
      selectDefaultTarget(events as never, new Set(['10:1', '10:2'])),
    ).toEqual({
      id: 10,
      instance: 2,
    })
  })

  it('sorts boss targets first and formats labels by observed instance count', () => {
    const options = buildFightTargetOptions({
      enemies: [
        {
          id: 10,
          name: 'Deathknight Understudy',
          type: 'NPC',
          subType: 'NPC',
        },
        {
          id: 20,
          name: 'Grand Widow',
          type: 'NPC',
          subType: 'Boss',
        },
      ],
      events: [
        {
          sourceID: 10,
          sourceInstance: 3,
          targetID: 1,
          targetInstance: 0,
          threat: {
            changes: [],
          },
        },
        {
          sourceID: 10,
          sourceInstance: 2,
          targetID: 1,
          targetInstance: 0,
          threat: {
            changes: [],
          },
        },
        {
          sourceID: 20,
          sourceInstance: 0,
          targetID: 1,
          targetInstance: 0,
          threat: {
            changes: [],
          },
        },
      ] as never,
    })

    expect(options.map((option) => option.label)).toEqual([
      'Grand Widow (20)',
      'Deathknight Understudy (10.2)',
      'Deathknight Understudy (10.3)',
    ])
    expect(options.map((option) => option.isBoss)).toEqual([true, false, false])
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

  it('maps modifier schoolMask values to school labels', () => {
    const actors: ReportActorSummary[] = [
      {
        id: 1,
        name: 'Paladin',
        type: 'Player',
        subType: 'Paladin',
      },
      {
        id: 10,
        name: 'Boss',
        type: 'NPC',
        subType: 'Boss',
      },
    ]
    const abilities: ReportAbilitySummary[] = [
      {
        gameID: 100,
        icon: null,
        name: 'Damage Shield',
        type: '8',
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
        amount: 200,
        threat: {
          changes: [
            {
              sourceId: 1,
              targetId: 10,
              targetInstance: 0,
              operator: 'add',
              amount: 200,
              total: 200,
            },
          ],
          calculation: {
            formula: 'damage',
            amount: 200,
            baseThreat: 200,
            modifiedThreat: 200,
            isSplit: false,
            modifiers: [
              {
                name: 'Righteous Fury',
                value: 1.6,
                schoolMask: 2,
              },
            ],
          },
        },
      },
    ]

    const series = buildThreatSeries({
      events: events as never,
      actors,
      abilities,
      fightStartTime: 1000,
      fightEndTime: 2000,
      target: {
        id: 10,
        instance: 0,
      },
    })

    expect(series[0]?.points[1]?.modifiers).toEqual([
      {
        name: 'Righteous Fury',
        schoolLabels: ['holy'],
        value: 1.6,
      },
    ])
  })

  it('preserves resource type for resource change events', () => {
    const actors: ReportActorSummary[] = [
      {
        id: 1,
        name: 'Warrior',
        type: 'Player',
        subType: 'Warrior',
      },
      {
        id: 10,
        name: 'Boss',
        type: 'NPC',
        subType: 'Boss',
      },
    ]
    const abilities: ReportAbilitySummary[] = [
      {
        gameID: 100,
        icon: null,
        name: 'Bloodrage',
        type: '1',
      },
    ]
    const events = [
      {
        timestamp: 1000,
        type: 'resourcechange',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 10,
        targetIsFriendly: false,
        abilityGameID: 100,
        resourceChange: 5,
        resourceChangeType: ResourceTypeCode.Rage,
        threat: {
          changes: [
            {
              sourceId: 1,
              targetId: 10,
              targetInstance: 0,
              operator: 'add',
              amount: 25,
              total: 25,
            },
          ],
          calculation: {
            formula: 'rage * 5',
            amount: 5,
            baseThreat: 25,
            modifiedThreat: 25,
            isSplit: false,
            modifiers: [],
          },
        },
      },
    ]

    const series = buildThreatSeries({
      events: events as never,
      actors,
      abilities,
      fightStartTime: 1000,
      fightEndTime: 2000,
      target: {
        id: 10,
        instance: 0,
      },
    })

    expect(series[0]?.points[1]?.resourceType).toBe(ResourceTypeCode.Rage)
    expect(series[0]?.points[1]?.spellSchool).toBeNull()
  })

  it('adds boss melee markers to the struck player series for the selected target', () => {
    const actors: ReportActorSummary[] = [
      {
        id: 1,
        name: 'Tank',
        type: 'Player',
        subType: 'Warrior',
      },
      {
        id: 2,
        name: 'Healer',
        type: 'Player',
        subType: 'Priest',
      },
      {
        id: 10,
        name: 'Boss',
        type: 'NPC',
        subType: 'Boss',
      },
    ]
    const abilities: ReportAbilitySummary[] = [
      {
        gameID: 1,
        icon: null,
        name: 'Melee',
        type: '1',
      },
      {
        gameID: 100,
        icon: null,
        name: 'Shield Slam',
        type: '1',
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
        amount: 200,
        threat: {
          changes: [
            {
              sourceId: 1,
              targetId: 10,
              targetInstance: 0,
              operator: 'add',
              amount: 200,
              total: 200,
            },
          ],
          calculation: {
            formula: 'damage',
            amount: 200,
            baseThreat: 200,
            modifiedThreat: 200,
            isSplit: false,
            modifiers: [],
          },
        },
      },
      {
        timestamp: 1200,
        type: 'damage',
        sourceID: 10,
        sourceIsFriendly: false,
        targetID: 1,
        targetIsFriendly: true,
        abilityGameID: 9999,
        amount: 700,
        threat: {
          changes: [],
          calculation: {
            formula: '0 (boss melee marker)',
            amount: 700,
            baseThreat: 0,
            modifiedThreat: 0,
            isSplit: false,
            modifiers: [],
            effects: [
              {
                type: 'eventMarker',
                marker: 'bossMelee',
              },
            ],
          },
        },
      },
      {
        timestamp: 1300,
        type: 'damage',
        sourceID: 10,
        sourceIsFriendly: false,
        targetID: 2,
        targetIsFriendly: true,
        abilityGameID: 9998,
        amount: 550,
        threat: {
          changes: [],
          calculation: {
            formula: '0 (boss melee marker)',
            amount: 550,
            baseThreat: 0,
            modifiedThreat: 0,
            isSplit: false,
            modifiers: [],
            effects: [
              {
                type: 'eventMarker',
                marker: 'bossMelee',
              },
            ],
          },
        },
      },
    ]

    const series = buildThreatSeries({
      events: events as never,
      actors,
      abilities,
      fightStartTime: 1000,
      fightEndTime: 2000,
      target: {
        id: 10,
        instance: 0,
      },
    })

    const tankSeries = series.find((entry) => entry.actorId === 1)
    const healerSeries = series.find((entry) => entry.actorId === 2)

    expect(tankSeries?.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          timeMs: 200,
          totalThreat: 200,
          markerKind: 'bossMelee',
        }),
      ]),
    )
    expect(healerSeries?.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          timeMs: 300,
          totalThreat: 0,
          markerKind: 'bossMelee',
        }),
      ]),
    )
  })

  it('adds death markers from augmented event effects', () => {
    const actors: ReportActorSummary[] = [
      {
        id: 1,
        name: 'Tank',
        type: 'Player',
        subType: 'Warrior',
      },
      {
        id: 10,
        name: 'Boss',
        type: 'NPC',
        subType: 'Boss',
      },
    ]
    const abilities: ReportAbilitySummary[] = [
      {
        gameID: 100,
        icon: null,
        name: 'Shield Slam',
        type: '1',
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
        amount: 200,
        threat: {
          changes: [
            {
              sourceId: 1,
              targetId: 10,
              targetInstance: 0,
              operator: 'add',
              amount: 200,
              total: 200,
            },
          ],
          calculation: {
            formula: 'damage',
            amount: 200,
            baseThreat: 200,
            modifiedThreat: 200,
            isSplit: false,
            modifiers: [],
          },
        },
      },
      {
        timestamp: 1200,
        type: 'death',
        sourceID: 10,
        sourceIsFriendly: false,
        targetID: 1,
        targetIsFriendly: true,
        threat: {
          changes: [],
          calculation: {
            formula: '0',
            amount: 0,
            baseThreat: 0,
            modifiedThreat: 0,
            isSplit: false,
            modifiers: [],
            effects: [
              {
                type: 'eventMarker',
                marker: 'death',
              },
            ],
          },
        },
      },
    ]

    const series = buildThreatSeries({
      events: events as never,
      actors,
      abilities,
      fightStartTime: 1000,
      fightEndTime: 2000,
      target: {
        id: 10,
        instance: 0,
      },
    })

    const tankSeries = series.find((entry) => entry.actorId === 1)
    expect(tankSeries?.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          timeMs: 200,
          totalThreat: 200,
          markerKind: 'death',
        }),
      ]),
    )
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
      {
        gameID: 355,
        icon: null,
        name: 'Mocking Blow',
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
      target: {
        id: 10,
        instance: 0,
      },
    })

    expect(series).toHaveLength(1)
    expect(series[0]?.stateVisualSegments).toEqual([
      {
        kind: 'fixate',
        spellId: 355,
        spellName: 'Mocking Blow',
        startMs: 100,
        endMs: 150,
      },
      { kind: 'invulnerable', spellId: 642, startMs: 150, endMs: 175 },
      { kind: 'aggroLoss', spellId: 118, startMs: 175, endMs: 225 },
      {
        kind: 'fixate',
        spellId: 355,
        spellName: 'Mocking Blow',
        startMs: 225,
        endMs: 250,
      },
      { kind: 'aggroLoss', spellId: 10346, startMs: 300, endMs: 500 },
    ])
    expect(series[0]?.fixateWindows).toEqual([{ startMs: 100, endMs: 250 }])
    expect(series[0]?.invulnerabilityWindows).toEqual([
      { startMs: 150, endMs: 200 },
    ])
    const invulnerabilityStartPoint = series[0]?.points.find(
      (point) => point.timeMs === 150,
    )
    expect(invulnerabilityStartPoint).toBeDefined()
    expect(invulnerabilityStartPoint?.markerKind).toBeUndefined()
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
        target: {
          id: 10,
          instance: 0,
        },
        focusedPlayerId: 1,
        windowStartMs: 0,
        windowEndMs: 1500,
      }),
    ).toEqual({
      actorId: 1,
      label: 'Warrior',
      actorClass: 'Warrior',
      totalThreat: 150,
      totalTps: 100,
      totalDamage: 300,
      totalHealing: 0,
      color: getClassColor('Warrior'),
    })
  })

  it('builds focused pet summary for the selected window', () => {
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
    ]

    expect(
      buildFocusedPlayerSummary({
        events: events as never,
        actors,
        fightStartTime: 1000,
        target: {
          id: 10,
          instance: 0,
        },
        focusedPlayerId: 5,
        windowStartMs: 0,
        windowEndMs: 1000,
      }),
    ).toEqual({
      actorId: 5,
      label: 'Pet (Warrior)',
      actorClass: 'Warrior',
      talentPoints: undefined,
      totalThreat: 50,
      totalTps: 50,
      totalDamage: 100,
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
      target: {
        id: 10,
        instance: 0,
      },
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
        isHeal: false,
        isFixate: false,
      },
    ])
  })

  it('builds focused pet threat rows for the selected window', () => {
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
    ]

    const rows = buildFocusedPlayerThreatRows({
      events: events as never,
      actors,
      abilities,
      fightStartTime: 1000,
      target: {
        id: 10,
        instance: 0,
      },
      focusedPlayerId: 5,
      windowStartMs: 0,
      windowEndMs: 1000,
    })

    expect(rows).toEqual([
      {
        key: '200',
        abilityId: 200,
        abilityName: 'Bite',
        amount: 100,
        threat: 50,
        tps: 50,
        isHeal: false,
        isFixate: false,
      },
    ])
  })

  it('marks heal and fixate rows and omits tps for fixate entries', () => {
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
        gameID: 355,
        icon: null,
        name: 'Taunt',
        type: 'ability',
      },
      {
        gameID: 48438,
        icon: null,
        name: 'Wild Growth',
        type: 'ability',
      },
    ]
    const events = [
      {
        timestamp: 1000,
        type: 'cast',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 10,
        targetIsFriendly: false,
        abilityGameID: 355,
        threat: {
          changes: [
            {
              sourceId: 1,
              targetId: 10,
              targetInstance: 0,
              operator: 'set',
              amount: 100000,
              total: 100000,
            },
          ],
          calculation: {
            formula: 'taunt set',
            amount: 0,
            baseThreat: 0,
            modifiedThreat: 100000,
            isSplit: false,
            modifiers: [],
            effects: [
              {
                type: 'state',
                state: {
                  kind: 'fixate',
                  phase: 'start',
                  spellId: 355,
                  actorId: 1,
                  targetId: 10,
                  targetInstance: 0,
                },
              },
            ],
          },
        },
      },
      {
        timestamp: 1200,
        type: 'heal',
        sourceID: 1,
        sourceIsFriendly: true,
        targetID: 1,
        targetIsFriendly: true,
        abilityGameID: 48438,
        amount: 200,
        threat: {
          changes: [
            {
              sourceId: 1,
              targetId: 10,
              targetInstance: 0,
              operator: 'add',
              amount: 100,
              total: 100100,
            },
          ],
          calculation: {
            formula: 'heal',
            amount: 200,
            baseThreat: 100,
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
      target: {
        id: 10,
        instance: 0,
      },
      focusedPlayerId: 1,
      windowStartMs: 0,
      windowEndMs: 1000,
    })

    expect(rows).toEqual([
      {
        key: '355',
        abilityId: 355,
        abilityName: 'Taunt',
        amount: 0,
        threat: 100000,
        tps: null,
        isHeal: false,
        isFixate: true,
      },
      {
        key: '48438',
        abilityId: 48438,
        abilityName: 'Wild Growth',
        amount: 200,
        threat: 100,
        tps: 100,
        isHeal: true,
        isFixate: false,
      },
    ])
  })

  describe('initial auras', () => {
    it('extracts notable aura IDs from threat config', () => {
      const config = {
        auraModifiers: {
          100: () => ({
            source: 'stance',
            name: 'Defensive Stance',
            value: 1.3,
          }),
          200: () => ({ source: 'buff', name: 'Battle Shout', value: 1.1 }),
        },
        classes: {
          warrior: {
            auraModifiers: {
              300: () => ({ source: 'talent', name: 'Defiance', value: 1.15 }),
            },
          },
          paladin: {
            auraModifiers: {
              400: () => ({
                source: 'buff',
                name: 'Righteous Fury',
                value: 1.6,
              }),
            },
          },
        },
      }

      const result = getNotableAuraIds(config)
      expect(result).toEqual(new Set([100, 200, 300, 400]))
    })

    it('gets initial auras from combatant info event', () => {
      const events = [
        {
          timestamp: 1000,
          type: 'combatantinfo',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 0,
          targetIsFriendly: false,
          auras: [
            { abilityGameID: 71, name: 'Defensive Stance', stacks: 1 },
            { abilityGameID: 12303, name: 'Defiance', stacks: 5 },
            { abilityGameID: 25289, name: 'Battle Shout', stacks: 1 },
          ],
          threat: {
            changes: [],
            calculation: {
              formula: 'none',
              amount: 0,
              baseThreat: 0,
              modifiedThreat: 0,
              isSplit: false,
              modifiers: [],
            },
          },
        },
        {
          timestamp: 1100,
          type: 'damage',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 10,
          targetIsFriendly: false,
          threat: {
            changes: [],
            calculation: {
              formula: 'damage',
              amount: 100,
              baseThreat: 100,
              modifiedThreat: 100,
              isSplit: false,
              modifiers: [],
            },
          },
        },
      ] as never

      const result = getInitialAuras(events, 1)
      expect(result).toEqual([
        { abilityGameID: 71, name: 'Defensive Stance', stacks: 1 },
        { abilityGameID: 12303, name: 'Defiance', stacks: 5 },
        { abilityGameID: 25289, name: 'Battle Shout', stacks: 1 },
      ])
    })

    it('sorts notable initial auras first and keeps non-notable auras below', () => {
      const events = [
        {
          timestamp: 1000,
          type: 'combatantinfo',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 0,
          targetIsFriendly: false,
          auras: [
            { abilityGameID: 71, name: 'Defensive Stance', stacks: 1 },
            { abilityGameID: 12303, name: 'Defiance', stacks: 5 },
            { abilityGameID: 25289, name: 'Battle Shout', stacks: 1 },
            { abilityGameID: 9999, name: 'Non-Notable Buff', stacks: 1 },
          ],
          threat: {
            changes: [],
            calculation: {
              formula: 'none',
              amount: 0,
              baseThreat: 0,
              modifiedThreat: 0,
              isSplit: false,
              modifiers: [],
            },
          },
        },
      ] as never

      const config = {
        auraModifiers: {},
        classes: {
          warrior: {
            auraModifiers: {
              71: () => ({
                source: 'stance',
                name: 'Defensive Stance',
                value: 1.3,
              }),
              12303: () => ({
                source: 'talent',
                name: 'Defiance',
                value: 1.15,
              }),
            },
          },
        },
      }

      const result = buildInitialAurasDisplay(events, 1, config)
      expect(result).toEqual([
        {
          spellId: 71,
          name: 'Defensive Stance',
          stacks: 1,
          isNotable: true,
        },
        {
          spellId: 12303,
          name: 'Defiance',
          stacks: 5,
          isNotable: true,
        },
        {
          spellId: 25289,
          name: 'Battle Shout',
          stacks: 1,
          isNotable: false,
        },
        {
          spellId: 9999,
          name: 'Non-Notable Buff',
          stacks: 1,
          isNotable: false,
        },
      ])
    })

    it('returns empty array when no combatant info event exists', () => {
      const events = [] as never
      const result = getInitialAuras(events, 1)
      expect(result).toEqual([])
    })

    it('returns empty array when focusedPlayerId is null', () => {
      const events = [] as never
      const config = { auraModifiers: {} }
      const result = buildInitialAurasDisplay(events, null, config)
      expect(result).toEqual([])
    })

    it('returns all initial auras as non-notable when threat config is null', () => {
      const events = [
        {
          timestamp: 1000,
          type: 'combatantinfo',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 0,
          targetIsFriendly: false,
          auras: [{ abilityGameID: 71, name: 'Defensive Stance', stacks: 1 }],
          threat: {
            changes: [],
            calculation: {
              formula: 'none',
              amount: 0,
              baseThreat: 0,
              modifiedThreat: 0,
              isSplit: false,
              modifiers: [],
            },
          },
        },
      ] as never

      const result = buildInitialAurasDisplay(events, 1, null)
      expect(result).toEqual([
        {
          spellId: 71,
          name: 'Defensive Stance',
          stacks: 1,
          isNotable: false,
        },
      ])
    })

    it('filters out auras without a valid spell id', () => {
      const events = [
        {
          timestamp: 1000,
          type: 'combatantinfo',
          sourceID: 1,
          sourceIsFriendly: true,
          targetID: 0,
          targetIsFriendly: false,
          auras: [
            { abilityGameID: 71, name: 'Defensive Stance', stacks: 1 },
            { ability: 12303, name: 'Defiance', stacks: 5 },
            { name: 'Missing Spell', stacks: 1 },
            { abilityGameID: 0, name: 'Zero Spell', stacks: 1 },
          ],
          threat: {
            changes: [],
            calculation: {
              formula: 'none',
              amount: 0,
              baseThreat: 0,
              modifiedThreat: 0,
              isSplit: false,
              modifiers: [],
            },
          },
        },
      ] as never

      const result = getInitialAuras(events, 1)
      expect(result).toEqual([
        { abilityGameID: 71, name: 'Defensive Stance', stacks: 1 },
        { ability: 12303, name: 'Defiance', stacks: 5 },
      ])
    })
  })
})
