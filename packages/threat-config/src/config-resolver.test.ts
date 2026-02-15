/**
 * Tests for report metadata threat config resolution.
 */
import { describe, expect, it } from 'vitest'

import { resolveConfigOrNull } from './config-resolver'
import { eraConfig } from './era'
import { sodConfig } from './sod'
import { anniversaryConfig } from './tbc'

describe('resolveConfigOrNull', () => {
  it('returns null for retail gameVersion 1', () => {
    const config = resolveConfigOrNull({
      gameVersion: 1,
      zone: {},
      fights: [],
    })

    expect(config).toBeNull()
  })

  it('resolves sod for gameVersion 2 with SoD season id', () => {
    const config = resolveConfigOrNull({
      gameVersion: 2,
      zone: {},
      fights: [
        {
          classicSeasonID: 3,
        },
      ],
    })

    expect(config).toBe(sodConfig)
  })

  it('resolves anniversary for gameVersion 2 with Anniversary season id', () => {
    const config = resolveConfigOrNull({
      gameVersion: 2,
      zone: {},
      fights: [
        {
          classicSeasonID: 5,
        },
      ],
    })

    expect(config).toBe(anniversaryConfig)
  })

  it('resolves sod for discovery partition names', () => {
    const config = resolveConfigOrNull({
      gameVersion: 2,
      zone: {
        partitions: [{ id: 1, name: 'Discovery P8' }],
      },
      fights: [],
    })

    expect(config).toBe(sodConfig)
  })

  it('resolves era for era partition names', () => {
    const config = resolveConfigOrNull({
      gameVersion: 2,
      zone: {
        partitions: [{ id: 1, name: 'S0' }],
      },
      fights: [],
    })

    expect(config).toBe(eraConfig)
  })

  it('resolves anniversary for phase partitions', () => {
    const config = resolveConfigOrNull({
      gameVersion: 2,
      zone: {
        partitions: [{ id: 1, name: 'Phase 5' }],
      },
      fights: [],
    })

    expect(config).toBe(anniversaryConfig)
  })

  it('returns null for classic progression game version', () => {
    const config = resolveConfigOrNull({
      gameVersion: 6,
      zone: {},
      fights: [],
    })

    expect(config).toBeNull()
  })

  it('returns null for unknown classic season ids', () => {
    const config = resolveConfigOrNull({
      gameVersion: 2,
      zone: {},
      fights: [
        {
          classicSeasonID: 42,
        },
      ],
    })

    expect(config).toBeNull()
  })

  it('returns null for gameVersion 2 when season and partitions are missing', () => {
    const config = resolveConfigOrNull({
      gameVersion: 2,
      zone: {},
      fights: [],
    })

    expect(config).toBeNull()
  })
})
