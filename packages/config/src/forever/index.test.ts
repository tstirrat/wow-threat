/**
 * Tests for the WoW Forever config and its gameVersion-based resolver.
 */
import type { ThreatConfigResolutionInput } from '@wow-threat/shared'
import { describe, expect, it } from 'vitest'

import { eraConfig } from '../era'
import { foreverConfig } from './index'

function createResolutionInput(
  gameVersion: number,
): ThreatConfigResolutionInput {
  return {
    report: {
      startTime: Date.UTC(2026, 0, 1),
      masterData: { gameVersion },
      zone: { partitions: [] },
      fights: [],
    },
  }
}

describe('forever config', () => {
  it('uses Era as its provisional baseline', () => {
    expect(foreverConfig.displayName).toBe('WoW Forever')
    expect(foreverConfig.version).toBe(3)
    expect(foreverConfig.baseThreat).toBe(eraConfig.baseThreat)
    expect(foreverConfig.classes.druid).not.toBe(eraConfig.classes.druid)
    expect(foreverConfig.classes.paladin).not.toBe(eraConfig.classes.paladin)
    expect(foreverConfig.classes.warrior).toBe(eraConfig.classes.warrior)
    expect(foreverConfig.wowhead).toEqual({ domain: 'forever' })
  })

  it('resolves gameVersion 7 without zone, season, or partition metadata', () => {
    expect(foreverConfig.resolve(createResolutionInput(7))).toBe(true)
  })

  it.each([1, 2, 3, 6, 999])(
    'does not resolve gameVersion %i',
    (gameVersion) => {
      expect(foreverConfig.resolve(createResolutionInput(gameVersion))).toBe(
        false,
      )
    },
  )
})
