/**
 * Tests for shareable player threat override parsing and config discovery.
 */
import { foreverConfig } from '@wow-threat/config'
import { describe, expect, it } from 'vitest'

import {
  applyLegacyRighteousFuryOverride,
  buildThreatOverrideOptions,
  parseThreatOverridesParam,
  resolveAuraOptionState,
  serializeAuraOverridesByActor,
  serializeTalentRankOverridesByActor,
  serializeThreatOverridesParam,
} from './threat-overrides'

describe('threat-overrides', () => {
  it('round-trips a stable actor, aura, and talent URL value', () => {
    const parsed = parseThreatOverridesParam(
      '2:t137878=0,a25895=0;1:t137877=5,a25780=1',
    )

    expect(serializeThreatOverridesParam(parsed)).toBe(
      '1:a25780=1,t137877=5;2:a25895=0,t137878=0',
    )
  })

  it('ignores malformed URL tokens', () => {
    expect(
      parseThreatOverridesParam(
        'bad:a25780=1;1:a0=1,a25780=3,t137877=-1,nope,t137878=2',
      ),
    ).toEqual({
      '1': {
        auras: {},
        talents: { '137878': 2 },
      },
    })
  })

  it('supports the temporary forceRf parameter as a compatibility alias', () => {
    const overrides = applyLegacyRighteousFuryOverride({}, '7')

    expect(overrides['7']?.auras['25780']).toBe('on')
    expect(serializeThreatOverridesParam(overrides)).toBe('7:a25780=1')
  })

  it('serializes worker aura and talent override records', () => {
    const overrides = parseThreatOverridesParam(
      '1:a25780=1,a25895=0,t137877=4,t137878=0',
    )

    expect(serializeAuraOverridesByActor(overrides)).toEqual({
      '1': { add: [25780], remove: [25895] },
    })
    expect(serializeTalentRankOverridesByActor(overrides)).toEqual({
      '1': { '137877': 4, '137878': 0 },
    })
  })

  it('discovers Forever Paladin auras and ranked talents from config', () => {
    const options = buildThreatOverrideOptions(foreverConfig, 'Paladin')

    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'aura',
          label: 'Blessing of Salvation',
        }),
        expect.objectContaining({
          kind: 'aura',
          label: 'Righteous Fury',
        }),
        expect.objectContaining({
          kind: 'talent',
          label: 'Iron Creed',
          maxRank: 5,
        }),
        expect.objectContaining({
          kind: 'talent',
          label: 'Instrument of Law',
          maxRank: 2,
        }),
      ]),
    )
  })

  it('only exposes the common Salvation option for other classes', () => {
    const options = buildThreatOverrideOptions(foreverConfig, 'Warrior')

    expect(options).toHaveLength(1)
    expect(options[0]).toMatchObject({
      kind: 'aura',
      label: 'Blessing of Salvation',
    })
  })

  it('resolves grouped Salvation choices as a single state', () => {
    const option = buildThreatOverrideOptions(foreverConfig, 'Paladin').find(
      (candidate) => candidate.label === 'Blessing of Salvation',
    )
    expect(option?.kind).toBe('aura')
    if (!option || option.kind !== 'aura') {
      return
    }

    expect(
      resolveAuraOptionState(
        {
          auras: { '1038': 'off', '25895': 'on' },
          talents: {},
        },
        option,
      ),
    ).toBe('on')
    expect(
      resolveAuraOptionState(
        {
          auras: { '1038': 'off', '25895': 'off' },
          talents: {},
        },
        option,
      ),
    ).toBe('off')
  })
})
