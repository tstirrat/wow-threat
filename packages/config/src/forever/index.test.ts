/**
 * Tests for the dormant WoW Forever config scaffold.
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

describe('forever config scaffold', () => {
  it('uses Era as its provisional baseline', () => {
    expect(foreverConfig.displayName).toBe('WoW Forever')
    expect(foreverConfig.version).toBe(2)
    expect(foreverConfig.baseThreat).toBe(eraConfig.baseThreat)
    expect(foreverConfig.classes.druid).not.toBe(eraConfig.classes.druid)
    expect(foreverConfig.classes.paladin).not.toBe(eraConfig.classes.paladin)
    expect(foreverConfig.classes.warrior).toBe(eraConfig.classes.warrior)
    expect(foreverConfig.wowhead).toEqual({ domain: 'forever' })
  })

  it.each([1, 2, 3, 6, 999])(
    'does not resolve gameVersion %i before WCL metadata is known',
    (gameVersion) => {
      expect(foreverConfig.resolve(createResolutionInput(gameVersion))).toBe(
        false,
      )
    },
  )
})
