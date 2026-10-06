/**
 * Unit tests for client-side threat config resolution helpers.
 */
import { eraConfig, sodConfig } from '@wow-threat/config'
import { describe, expect, it } from 'vitest'

import type { ReportResponse } from '../types/api'
import {
  readForcedThreatConfigParam,
  resolveCurrentThreatConfig,
  threatConfigCacheScope,
} from './threat-config'

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

  it('uses a forced config id instead of report metadata', () => {
    const report = createReportResponse({
      gameVersion: 1,
      threatConfig: null,
      zone: {
        id: 1001,
        name: 'Naxxramas',
      },
      fights: [],
    })

    const resolved = resolveCurrentThreatConfig(report, 'era')

    expect(resolved).toBe(eraConfig)
    expect(resolved?.displayName).toBe('Vanilla (Era)')
  })
})

describe('forced threat config query param', () => {
  it('treats a missing param as automatic detection', () => {
    expect(readForcedThreatConfigParam(null)).toEqual({
      configId: null,
      isInvalid: false,
      rawValue: null,
    })
    expect(threatConfigCacheScope(null)).toBeNull()
  })

  it('accepts era and the tbc alias', () => {
    expect(readForcedThreatConfigParam('era')).toMatchObject({
      configId: 'era',
      isInvalid: false,
    })
    expect(readForcedThreatConfigParam('tbc')).toMatchObject({
      configId: 'anniversary',
      isInvalid: false,
    })
    expect(threatConfigCacheScope('era')).toBe(
      `era@${String(eraConfig.version)}`,
    )
  })

  it('marks unknown config ids as invalid', () => {
    expect(readForcedThreatConfigParam('retail')).toEqual({
      configId: null,
      isInvalid: true,
      rawValue: 'retail',
    })
  })
})
