/**
 * Unit tests for report fight navigation grouping helpers.
 */
import type { ReportFightSummary } from '../types/api'

import { buildFightNavigationGroups } from './fight-navigation'

const createFight = (
  overrides: Partial<ReportFightSummary> & Pick<ReportFightSummary, 'id' | 'name'>,
): ReportFightSummary => ({
  id: overrides.id,
  encounterID: overrides.encounterID ?? null,
  name: overrides.name,
  startTime: overrides.startTime ?? overrides.id * 1000,
  endTime: overrides.endTime ?? overrides.id * 1000 + 900,
  kill: overrides.kill ?? true,
  difficulty: null,
  bossPercentage: overrides.bossPercentage ?? null,
  fightPercentage: overrides.fightPercentage ?? null,
  enemyNPCs: [],
  enemyPets: [],
  friendlyPlayers: [],
  friendlyPets: [],
})

describe('buildFightNavigationGroups', () => {
  it('groups boss kills first and attaches wipes by encounter', () => {
    const fights = [
      createFight({ id: 11, encounterID: 1001, name: 'Razorgore', kill: false }),
      createFight({ id: 12, name: 'Trash Pack', kill: true }),
      createFight({ id: 13, encounterID: 1001, name: 'Razorgore', kill: true }),
      createFight({ id: 14, encounterID: 1002, name: 'Vaelastrasz', kill: true }),
      createFight({ id: 15, encounterID: 1002, name: 'Vaelastrasz', kill: false }),
      createFight({ id: 16, name: 'Suppression Room', kill: true }),
      createFight({ id: 17, encounterID: 1003, name: 'Chromaggus', kill: false }),
    ]

    const grouped = buildFightNavigationGroups(fights)

    expect(grouped.bossEncounters.map((row) => row.name)).toEqual([
      'Razorgore',
      'Vaelastrasz',
    ])
    expect(grouped.bossEncounters[0]?.primaryKill.id).toBe(13)
    expect(grouped.bossEncounters[0]?.wipes.map((fight) => fight.id)).toEqual([11])
    expect(grouped.bossEncounters[1]?.primaryKill.id).toBe(14)
    expect(grouped.bossEncounters[1]?.wipes.map((fight) => fight.id)).toEqual([15])

    expect(grouped.trashFights.map((fight) => fight.id)).toEqual([12, 16])
    expect(grouped.bossEncounters.find((row) => row.name === 'Chromaggus')).toBeUndefined()
  })

  it('keeps additional kills after the primary kill for an encounter', () => {
    const fights = [
      createFight({ id: 30, encounterID: 3001, name: 'Anubisath', kill: true }),
      createFight({ id: 31, encounterID: 3001, name: 'Anubisath', kill: false }),
      createFight({ id: 32, encounterID: 3001, name: 'Anubisath', kill: true }),
    ]

    const grouped = buildFightNavigationGroups(fights)

    expect(grouped.bossEncounters).toHaveLength(1)
    expect(grouped.bossEncounters[0]?.primaryKill.id).toBe(30)
    expect(grouped.bossEncounters[0]?.extraKills.map((fight) => fight.id)).toEqual([32])
    expect(grouped.bossEncounters[0]?.wipes.map((fight) => fight.id)).toEqual([31])
  })

  it('treats fights with boss percentages as boss encounters when encounter id is missing', () => {
    const fights = [
      createFight({
        id: 40,
        name: 'Kel Thuzad',
        kill: false,
        bossPercentage: 12.5,
        fightPercentage: 87.5,
      }),
      createFight({
        id: 41,
        name: 'Kel Thuzad',
        kill: true,
        bossPercentage: 0,
        fightPercentage: 100,
      }),
      createFight({
        id: 42,
        name: 'Naxx Trash',
        kill: true,
        bossPercentage: null,
        fightPercentage: null,
      }),
    ]

    const grouped = buildFightNavigationGroups(fights)

    expect(grouped.bossEncounters).toHaveLength(1)
    expect(grouped.bossEncounters[0]?.name).toBe('Kel Thuzad')
    expect(grouped.bossEncounters[0]?.primaryKill.id).toBe(41)
    expect(grouped.bossEncounters[0]?.wipes.map((fight) => fight.id)).toEqual([40])
    expect(grouped.trashFights.map((fight) => fight.id)).toEqual([42])
  })

  it('sorts trash fights by start time', () => {
    const fights = [
      createFight({ id: 50, name: 'Trash B', startTime: 4000 }),
      createFight({ id: 51, name: 'Boss', encounterID: 5001, kill: true }),
      createFight({ id: 52, name: 'Trash A', startTime: 2000 }),
      createFight({ id: 53, name: 'Trash C', startTime: 6000 }),
    ]

    const grouped = buildFightNavigationGroups(fights)

    expect(grouped.trashFights.map((fight) => fight.id)).toEqual([52, 50, 53])
  })

  it('links wipes without encounter id to boss kills with matching encounter name', () => {
    const fights = [
      createFight({
        id: 60,
        encounterID: null,
        name: 'Ragnaros',
        kill: false,
        bossPercentage: null,
        fightPercentage: null,
      }),
      createFight({
        id: 61,
        encounterID: 7001,
        name: 'Ragnaros',
        kill: true,
        bossPercentage: 0,
        fightPercentage: 100,
      }),
    ]

    const grouped = buildFightNavigationGroups(fights)

    expect(grouped.bossEncounters).toHaveLength(1)
    expect(grouped.bossEncounters[0]?.name).toBe('Ragnaros')
    expect(grouped.bossEncounters[0]?.encounterID).toBe(7001)
    expect(grouped.bossEncounters[0]?.primaryKill.id).toBe(61)
    expect(grouped.bossEncounters[0]?.wipes.map((fight) => fight.id)).toEqual([60])
    expect(grouped.trashFights).toHaveLength(0)
  })
})
