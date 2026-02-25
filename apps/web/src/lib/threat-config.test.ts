/**
 * Unit tests for client-side threat config resolution helpers.
 */
import { sodConfig } from '@wow-threat/config'
import { describe, expect, it } from 'vitest'

import type { ReportResponse } from '../types/api'
import { resolveCurrentThreatConfig } from './threat-config'

function createReportResponse(
  overrides: Partial<ReportResponse> = {},
): ReportResponse {
  return {
    code: 'ABC123xyz',
    title: 'Threat Config Resolution Report',
    visibility: 'public',
    owner: 'test-owner',
    guild: null,
    archiveStatus: null,
    startTime: Date.UTC(2026, 1, 1, 0, 0, 0, 0),
    endTime: Date.UTC(2026, 1, 1, 1, 0, 0, 0),
    gameVersion: 2,
    threatConfig: {
      displayName: 'stale',
      version: 102,
    },
    zone: {
      id: 1001,
      name: 'Naxxramas',
      partitions: [{ id: 3, name: 'Discovery' }],
    },
    fights: [
      {
        id: 1,
        encounterID: 1602,
        classicSeasonID: 3,
        name: 'Patchwerk',
        startTime: Date.UTC(2026, 1, 1, 0, 0, 0, 0),
        endTime: Date.UTC(2026, 1, 1, 0, 5, 0, 0),
        kill: true,
        difficulty: 3,
        bossPercentage: null,
        fightPercentage: null,
        enemyNPCs: [],
        enemyPets: [],
        friendlyPlayers: [],
        friendlyPets: [],
      },
    ],
    actors: [],
    abilities: [],
    ...overrides,
  }
}

describe('threat-config helpers', () => {
  it('resolves version from metadata instead of stale report payload config', () => {
    const report = createReportResponse({
      threatConfig: {
        displayName: 'stale',
        version: 102,
      },
    })

    const resolved = resolveCurrentThreatConfig(report)

    expect(resolved).not.toBeNull()
    expect(resolved?.displayName).toBe('Season of Discovery')
    expect(resolved?.version).toBe(sodConfig.version)
    expect(resolved?.version).not.toBe(report.threatConfig?.version)
  })

  it('returns null for unsupported game versions', () => {
    const report = createReportResponse({
      gameVersion: 1,
      threatConfig: null,
    })

    const resolved = resolveCurrentThreatConfig(report)

    expect(resolved).toBeNull()
  })
})
