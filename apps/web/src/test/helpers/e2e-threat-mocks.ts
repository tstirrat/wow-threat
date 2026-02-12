/**
 * Shared mocked report/fight/events fixtures for Playwright page specs.
 */
import type { Page } from '@playwright/test'

import type {
  AugmentedEventsResponse,
  FightsResponse,
  ReportActorSummary,
  ReportFightParticipant,
  ReportResponse,
} from '../../types/api'

export const e2eReportId = 'f9yPamzBxQqhGndZ'
export const e2eReportTitle = 'Threat Regression Raid'
export const e2eValidFreshReportUrl = `https://fresh.warcraftlogs.com/reports/${e2eReportId}?view=rankings&fight=26`

const reportActors: ReportActorSummary[] = [
  {
    id: 1,
    name: 'Aegistank',
    type: 'Player',
    subType: 'Warrior',
  },
  {
    id: 2,
    name: 'Bladefury',
    type: 'Player',
    subType: 'Rogue',
  },
  {
    id: 3,
    name: 'Arrowyn',
    type: 'Player',
    subType: 'Hunter',
  },
  {
    id: 4,
    name: 'Wolfie',
    type: 'Pet',
    petOwner: 3,
  },
  {
    id: 100,
    name: 'Patchwerk',
    type: 'NPC',
    subType: 'Boss',
  },
  {
    id: 101,
    name: 'Grobbulus',
    type: 'NPC',
    subType: 'Boss',
  },
  {
    id: 102,
    name: 'Hateful Strike Target',
    type: 'NPC',
    subType: 'NPC',
  },
  {
    id: 103,
    name: 'Naxxramas Trash',
    type: 'NPC',
    subType: 'NPC',
  },
]

const patchwerkNpc: ReportFightParticipant = {
  id: 100,
  gameID: 1602,
  groupCount: 1,
  instanceCount: 1,
  name: 'Patchwerk',
  petOwner: null,
}

const grobbulusNpc: ReportFightParticipant = {
  id: 101,
  gameID: 1603,
  groupCount: 1,
  instanceCount: 1,
  name: 'Grobbulus',
  petOwner: null,
}

const hatefulStrikeNpc: ReportFightParticipant = {
  id: 102,
  gameID: 9001,
  groupCount: 1,
  instanceCount: 1,
  name: 'Hateful Strike Target',
  petOwner: null,
}

const trashNpc: ReportFightParticipant = {
  id: 103,
  gameID: 9002,
  groupCount: 1,
  instanceCount: 1,
  name: 'Naxxramas Trash',
  petOwner: null,
}

const wolfPet: ReportFightParticipant = {
  id: 4,
  gameID: 1,
  groupCount: 1,
  instanceCount: 1,
  name: 'Wolfie',
  petOwner: 3,
}

export const e2eReportResponse: ReportResponse = {
  abilities: [
    {
      gameID: 75,
      icon: 'inv_weapon_bow_07',
      name: 'Auto Shot',
      type: 'ability',
    },
    {
      gameID: 2054,
      icon: 'spell_holy_lesserheal',
      name: 'Lesser Heal',
      type: 'ability',
    },
    {
      gameID: 11267,
      icon: 'spell_shadow_ritualofsacrifice',
      name: 'Sinister Strike',
      type: 'ability',
    },
    {
      gameID: 23922,
      icon: 'inv_shield_05',
      name: 'Shield Slam',
      type: 'ability',
    },
    {
      gameID: 24599,
      icon: 'ability_druid_cower',
      name: 'Bite',
      type: 'ability',
    },
    {
      gameID: 25258,
      icon: 'ability_rogue_ambush',
      name: 'Heroic Strike',
      type: 'ability',
    },
  ],
  actors: reportActors,
  code: e2eReportId,
  endTime: 1400000,
  fights: [
    {
      bossPercentage: 12.4,
      difficulty: 3,
      encounterID: 1602,
      endTime: 1070000,
      enemyNPCs: [patchwerkNpc],
      enemyPets: [],
      fightPercentage: null,
      friendlyPets: [wolfPet],
      friendlyPlayers: [1, 2, 3],
      id: 25,
      kill: false,
      name: 'Patchwerk',
      startTime: 1010000,
    },
    {
      bossPercentage: null,
      difficulty: 3,
      encounterID: 1602,
      endTime: 1220000,
      enemyNPCs: [patchwerkNpc, hatefulStrikeNpc],
      enemyPets: [],
      fightPercentage: null,
      friendlyPets: [wolfPet],
      friendlyPlayers: [1, 2, 3],
      id: 26,
      kill: true,
      name: 'Patchwerk',
      startTime: 1100000,
    },
    {
      bossPercentage: null,
      difficulty: 3,
      encounterID: 1603,
      endTime: 1325000,
      enemyNPCs: [grobbulusNpc],
      enemyPets: [],
      fightPercentage: null,
      friendlyPets: [wolfPet],
      friendlyPlayers: [1, 2, 3],
      id: 30,
      kill: true,
      name: 'Grobbulus',
      startTime: 1250000,
    },
    {
      bossPercentage: null,
      difficulty: null,
      encounterID: null,
      endTime: 1360000,
      enemyNPCs: [trashNpc],
      enemyPets: [],
      fightPercentage: null,
      friendlyPets: [],
      friendlyPlayers: [1, 2, 3],
      id: 40,
      kill: false,
      name: 'Naxxramas Trash',
      startTime: 1330000,
    },
  ],
  gameVersion: 2,
  owner: 'ThreatOfficer',
  startTime: 1000000,
  threatConfig: {
    displayName: 'Fresh',
    version: '2026.2.12',
  },
  title: e2eReportTitle,
  zone: {
    id: 1001,
    name: 'Naxxramas',
  },
}

const fightsById: Record<number, FightsResponse> = {
  26: {
    actors: reportActors.filter((actor) => actor.type !== 'NPC'),
    difficulty: 3,
    endTime: 1220000,
    enemies: [
      {
        id: 100,
        name: 'Patchwerk',
        type: 'NPC',
        subType: 'Boss',
      },
      {
        id: 102,
        name: 'Hateful Strike Target',
        type: 'NPC',
        subType: 'NPC',
      },
    ],
    id: 26,
    kill: true,
    name: 'Patchwerk',
    reportCode: e2eReportId,
    startTime: 1100000,
  },
  30: {
    actors: reportActors.filter((actor) => actor.type !== 'NPC'),
    difficulty: 3,
    endTime: 1325000,
    enemies: [
      {
        id: 101,
        name: 'Grobbulus',
        type: 'NPC',
        subType: 'Boss',
      },
    ],
    id: 30,
    kill: true,
    name: 'Grobbulus',
    reportCode: e2eReportId,
    startTime: 1250000,
  },
}

function calculationFor({
  amount,
  baseThreat,
  formula,
  modifiedThreat,
}: {
  amount: number
  baseThreat: number
  formula: string
  modifiedThreat: number
}): AugmentedEventsResponse['events'][number]['threat']['calculation'] {
  return {
    amount,
    baseThreat,
    formula,
    isSplit: false,
    modifiedThreat,
    modifiers: [],
  }
}

const patchwerkEvents: AugmentedEventsResponse = {
  configVersion: '2026.2.12',
  events: [
    {
      abilityGameID: 23922,
      amount: 600,
      sourceID: 1,
      sourceIsFriendly: true,
      targetID: 100,
      targetIsFriendly: false,
      threat: {
        calculation: calculationFor({
          amount: 600,
          baseThreat: 600,
          formula: 'damage * 0.5',
          modifiedThreat: 300,
        }),
        changes: [
          {
            amount: 300,
            operator: 'add',
            sourceId: 1,
            targetId: 100,
            targetInstance: 0,
            total: 300,
          },
        ],
      },
      timestamp: 1101000,
      type: 'damage',
    },
    {
      abilityGameID: 11267,
      amount: 500,
      sourceID: 2,
      sourceIsFriendly: true,
      targetID: 100,
      targetIsFriendly: false,
      threat: {
        calculation: calculationFor({
          amount: 500,
          baseThreat: 500,
          formula: 'damage * 0.5',
          modifiedThreat: 250,
        }),
        changes: [
          {
            amount: 250,
            operator: 'add',
            sourceId: 2,
            targetId: 100,
            targetInstance: 0,
            total: 250,
          },
        ],
      },
      timestamp: 1102000,
      type: 'damage',
    },
    {
      abilityGameID: 75,
      amount: 300,
      sourceID: 3,
      sourceIsFriendly: true,
      targetID: 100,
      targetIsFriendly: false,
      threat: {
        calculation: calculationFor({
          amount: 300,
          baseThreat: 300,
          formula: 'damage * 0.5',
          modifiedThreat: 150,
        }),
        changes: [
          {
            amount: 150,
            operator: 'add',
            sourceId: 3,
            targetId: 100,
            targetInstance: 0,
            total: 150,
          },
        ],
      },
      timestamp: 1103000,
      type: 'damage',
    },
    {
      abilityGameID: 25258,
      amount: 240,
      sourceID: 1,
      sourceIsFriendly: true,
      targetID: 100,
      targetIsFriendly: false,
      threat: {
        calculation: calculationFor({
          amount: 240,
          baseThreat: 240,
          formula: 'damage * 0.5',
          modifiedThreat: 120,
        }),
        changes: [
          {
            amount: 120,
            operator: 'add',
            sourceId: 1,
            targetId: 100,
            targetInstance: 0,
            total: 420,
          },
        ],
      },
      timestamp: 1103500,
      type: 'damage',
    },
    {
      abilityGameID: 23922,
      amount: 300,
      sourceID: 1,
      sourceIsFriendly: true,
      targetID: 102,
      targetIsFriendly: false,
      threat: {
        calculation: calculationFor({
          amount: 300,
          baseThreat: 300,
          formula: 'damage * 0.4',
          modifiedThreat: 120,
        }),
        changes: [
          {
            amount: 120,
            operator: 'add',
            sourceId: 1,
            targetId: 102,
            targetInstance: 0,
            total: 120,
          },
        ],
      },
      timestamp: 1104000,
      type: 'damage',
    },
    {
      abilityGameID: 11267,
      amount: 360,
      sourceID: 2,
      sourceIsFriendly: true,
      targetID: 102,
      targetIsFriendly: false,
      threat: {
        calculation: calculationFor({
          amount: 360,
          baseThreat: 360,
          formula: 'damage * 0.5',
          modifiedThreat: 180,
        }),
        changes: [
          {
            amount: 180,
            operator: 'add',
            sourceId: 2,
            targetId: 102,
            targetInstance: 0,
            total: 180,
          },
        ],
      },
      timestamp: 1105000,
      type: 'damage',
    },
    {
      abilityGameID: 23922,
      amount: 400,
      sourceID: 1,
      sourceIsFriendly: true,
      targetID: 100,
      targetIsFriendly: false,
      threat: {
        calculation: calculationFor({
          amount: 400,
          baseThreat: 400,
          formula: 'damage * 0.325',
          modifiedThreat: 130,
        }),
        changes: [
          {
            amount: 130,
            operator: 'add',
            sourceId: 1,
            targetId: 100,
            targetInstance: 0,
            total: 550,
          },
        ],
      },
      timestamp: 1106000,
      type: 'damage',
    },
    {
      abilityGameID: 2054,
      amount: 200,
      sourceID: 3,
      sourceIsFriendly: true,
      targetID: 3,
      targetIsFriendly: true,
      threat: {
        calculation: calculationFor({
          amount: 200,
          baseThreat: 200,
          formula: 'heal * 0.35',
          modifiedThreat: 70,
        }),
        changes: [
          {
            amount: 70,
            operator: 'add',
            sourceId: 3,
            targetId: 100,
            targetInstance: 0,
            total: 220,
          },
        ],
      },
      timestamp: 1107000,
      type: 'heal',
    },
    {
      abilityGameID: 24599,
      amount: 200,
      sourceID: 4,
      sourceIsFriendly: true,
      targetID: 100,
      targetIsFriendly: false,
      threat: {
        calculation: calculationFor({
          amount: 200,
          baseThreat: 200,
          formula: 'damage * 0.4',
          modifiedThreat: 80,
        }),
        changes: [
          {
            amount: 80,
            operator: 'add',
            sourceId: 4,
            targetId: 100,
            targetInstance: 0,
            total: 80,
          },
        ],
      },
      timestamp: 1108000,
      type: 'damage',
    },
  ],
  fightId: 26,
  fightName: 'Patchwerk',
  gameVersion: 2,
  reportCode: e2eReportId,
  summary: {
    duration: 120000,
    eventCounts: {
      damage: 8,
      heal: 1,
    },
    totalEvents: 9,
  },
}

const grobbulusEvents: AugmentedEventsResponse = {
  configVersion: '2026.2.12',
  events: [
    {
      abilityGameID: 23922,
      amount: 500,
      sourceID: 1,
      sourceIsFriendly: true,
      targetID: 101,
      targetIsFriendly: false,
      threat: {
        calculation: calculationFor({
          amount: 500,
          baseThreat: 500,
          formula: 'damage * 0.4',
          modifiedThreat: 200,
        }),
        changes: [
          {
            amount: 200,
            operator: 'add',
            sourceId: 1,
            targetId: 101,
            targetInstance: 0,
            total: 200,
          },
        ],
      },
      timestamp: 1251000,
      type: 'damage',
    },
    {
      abilityGameID: 11267,
      amount: 520,
      sourceID: 2,
      sourceIsFriendly: true,
      targetID: 101,
      targetIsFriendly: false,
      threat: {
        calculation: calculationFor({
          amount: 520,
          baseThreat: 520,
          formula: 'damage * 0.5',
          modifiedThreat: 260,
        }),
        changes: [
          {
            amount: 260,
            operator: 'add',
            sourceId: 2,
            targetId: 101,
            targetInstance: 0,
            total: 260,
          },
        ],
      },
      timestamp: 1252000,
      type: 'damage',
    },
    {
      abilityGameID: 75,
      amount: 420,
      sourceID: 3,
      sourceIsFriendly: true,
      targetID: 101,
      targetIsFriendly: false,
      threat: {
        calculation: calculationFor({
          amount: 420,
          baseThreat: 420,
          formula: 'damage * 0.5',
          modifiedThreat: 210,
        }),
        changes: [
          {
            amount: 210,
            operator: 'add',
            sourceId: 3,
            targetId: 101,
            targetInstance: 0,
            total: 210,
          },
        ],
      },
      timestamp: 1253000,
      type: 'damage',
    },
  ],
  fightId: 30,
  fightName: 'Grobbulus',
  gameVersion: 2,
  reportCode: e2eReportId,
  summary: {
    duration: 75000,
    eventCounts: {
      damage: 3,
    },
    totalEvents: 3,
  },
}

const fightEventsById: Record<number, AugmentedEventsResponse> = {
  26: patchwerkEvents,
  30: grobbulusEvents,
}

function jsonResponse(body: unknown): {
  body: string
  contentType: string
  status: number
} {
  return {
    body: JSON.stringify(body),
    contentType: 'application/json',
    status: 200,
  }
}

function errorResponse(message: string): {
  body: string
  contentType: string
  status: number
} {
  return {
    body: JSON.stringify({
      error: {
        message,
      },
    }),
    contentType: 'application/json',
    status: 404,
  }
}

/** Install local storage reset + mocked API routes for threat e2e page tests. */
export async function setupThreatApiMocks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear()
  })

  await page.route('http://localhost:8787/v1/reports/**', async (route) => {
    const url = new URL(route.request().url())
    const reportMatch = url.pathname.match(/^\/v1\/reports\/([^/]+)$/)
    if (reportMatch) {
      const requestedReportId = reportMatch[1]
      if (requestedReportId === e2eReportId) {
        await route.fulfill(jsonResponse(e2eReportResponse))
        return
      }

      await route.fulfill(
        errorResponse(`Report ${requestedReportId} not found`),
      )
      return
    }

    const fightMatch = url.pathname.match(/^\/v1\/reports\/([^/]+)\/fights\/(\d+)$/)
    if (fightMatch) {
      const requestedReportId = fightMatch[1]
      const fightId = Number.parseInt(fightMatch[2] ?? '', 10)
      if (requestedReportId === e2eReportId && fightsById[fightId]) {
        await route.fulfill(jsonResponse(fightsById[fightId]))
        return
      }

      await route.fulfill(errorResponse(`Fight ${fightId} not found`))
      return
    }

    const eventsMatch = url.pathname.match(
      /^\/v1\/reports\/([^/]+)\/fights\/(\d+)\/events$/,
    )
    if (eventsMatch) {
      const requestedReportId = eventsMatch[1]
      const fightId = Number.parseInt(eventsMatch[2] ?? '', 10)
      if (requestedReportId === e2eReportId && fightEventsById[fightId]) {
        await route.fulfill(jsonResponse(fightEventsById[fightId]))
        return
      }

      await route.fulfill(
        errorResponse(`Events for fight ${fightId} not found`),
      )
      return
    }

    await route.fulfill(errorResponse(`Unhandled route ${url.pathname}`))
  })
}
