/**
 * Tests for report metadata threat config resolution.
 */
import { describe, expect, it } from 'vitest'

import { resolveConfigOrNull } from './config-resolver'
import { eraConfig } from './era'
import { sodConfig } from './sod'
import { anniversaryConfig } from './tbc'

const BEFORE_FRESH_TBC_CUTOVER = Date.UTC(2026, 0, 12, 23, 59, 59, 999)
const ON_FRESH_TBC_CUTOVER = Date.UTC(2026, 0, 13, 0, 0, 0, 0)

function createResolverInput(params: {
  gameVersion: number
  startTime?: number
  partitions?: Array<{ id: number; name: string }>
  fights?: Array<{ classicSeasonID?: number | null }>
}) {
  return {
    report: {
      startTime: params.startTime ?? ON_FRESH_TBC_CUTOVER,
      masterData: {
        gameVersion: params.gameVersion,
      },
      zone: {
        partitions: params.partitions,
      },
      fights: params.fights ?? [],
    },
  }
}

describe('resolveConfigOrNull', () => {
  it('exposes wowhead settings per config', () => {
    expect(eraConfig.wowhead).toEqual({
      domain: 'classic',
    })
    expect(sodConfig.wowhead).toEqual({
      domain: 'classic',
    })
    expect(anniversaryConfig.wowhead).toEqual({
      domain: 'tbc',
    })
  })

  it('returns null for retail gameVersion 1', () => {
    const config = resolveConfigOrNull(createResolverInput({ gameVersion: 1 }))

    expect(config).toBeNull()
  })

  it('resolves sod for gameVersion 2 with SoD season id', () => {
    const config = resolveConfigOrNull(
      createResolverInput({
        gameVersion: 2,
        fights: [
          {
            classicSeasonID: 3,
          },
        ],
      }),
    )

    expect(config).toBe(sodConfig)
  })

  it('resolves anniversary for gameVersion 2 with Anniversary season id', () => {
    const config = resolveConfigOrNull(
      createResolverInput({
        gameVersion: 2,
        fights: [
          {
            classicSeasonID: 5,
          },
        ],
      }),
    )

    expect(config).toBe(anniversaryConfig)
  })

  it('resolves anniversary for gameVersion 3 with Anniversary season id', () => {
    const config = resolveConfigOrNull(
      createResolverInput({
        gameVersion: 3,
        fights: [
          {
            classicSeasonID: 5,
          },
        ],
      }),
    )

    expect(config).toBe(anniversaryConfig)
  })

  it('resolves era for gameVersion 2 with Anniversary season id before 2026-01-13', () => {
    const config = resolveConfigOrNull(
      createResolverInput({
        gameVersion: 2,
        startTime: BEFORE_FRESH_TBC_CUTOVER,
        fights: [
          {
            classicSeasonID: 5,
          },
        ],
      }),
    )

    expect(config).toBe(eraConfig)
  })

  it('resolves sod for discovery partition names', () => {
    const config = resolveConfigOrNull(
      createResolverInput({
        gameVersion: 2,
        partitions: [{ id: 1, name: 'Discovery P8' }],
      }),
    )

    expect(config).toBe(sodConfig)
  })

  it('resolves era for era partition names', () => {
    const config = resolveConfigOrNull(
      createResolverInput({
        gameVersion: 2,
        partitions: [{ id: 1, name: 'S0' }],
      }),
    )

    expect(config).toBe(eraConfig)
  })

  it('resolves anniversary for phase partitions', () => {
    const config = resolveConfigOrNull(
      createResolverInput({
        gameVersion: 2,
        partitions: [{ id: 1, name: 'Phase 5' }],
        startTime: ON_FRESH_TBC_CUTOVER,
      }),
    )

    expect(config).toBe(anniversaryConfig)
  })

  it('resolves era for fresh phase partitions before 2026-01-13', () => {
    const config = resolveConfigOrNull(
      createResolverInput({
        gameVersion: 2,
        startTime: BEFORE_FRESH_TBC_CUTOVER,
        partitions: [{ id: 1, name: 'Phase 5' }],
      }),
    )

    expect(config).toBe(eraConfig)
  })

  it('resolves anniversary for fresh phase partitions on 2026-01-13 and later', () => {
    const config = resolveConfigOrNull(
      createResolverInput({
        gameVersion: 2,
        startTime: ON_FRESH_TBC_CUTOVER,
        partitions: [{ id: 1, name: 'Phase 5' }],
      }),
    )

    expect(config).toBe(anniversaryConfig)
  })

  it('returns null for classic progression game version', () => {
    const config = resolveConfigOrNull(createResolverInput({ gameVersion: 6 }))

    expect(config).toBeNull()
  })

  it('returns null for unknown classic season ids', () => {
    const config = resolveConfigOrNull(
      createResolverInput({
        gameVersion: 2,
        fights: [
          {
            classicSeasonID: 42,
          },
        ],
      }),
    )

    expect(config).toBeNull()
  })

  it('returns null for gameVersion 2 when season and partitions are missing', () => {
    const config = resolveConfigOrNull(createResolverInput({ gameVersion: 2 }))

    expect(config).toBeNull()
  })
})
