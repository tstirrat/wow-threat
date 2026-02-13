/**
 * Unit tests for threat aggregation helpers.
 */
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

  it('formats target labels using id or id.instance based on instance count', () => {
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
      'Deathknight Understudy (10.2)',
      'Deathknight Understudy (10.3)',
      'Grand Widow (20)',
    ])
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
      target: {
        id: 10,
        instance: 0,
      },
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

    it('filters initial auras to only show notable ones', () => {
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
        { abilityGameID: 71, name: 'Defensive Stance', stacks: 1 },
        { abilityGameID: 12303, name: 'Defiance', stacks: 5 },
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

    it('returns empty array when threat config is null', () => {
      const events = [] as never
      const result = buildInitialAurasDisplay(events, 1, null)
      expect(result).toEqual([])
    })
  })
})
