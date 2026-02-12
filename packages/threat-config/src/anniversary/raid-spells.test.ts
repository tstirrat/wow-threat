/**
 * Tests for Anniversary raid spell organization.
 */
import { describe, expect, it } from 'vitest'

import { anniversaryConfig } from './index'
import { aq40AggroLossBuffs, aq40AuraModifiers } from './raids/aq40'
import { bwlAggroLossBuffs } from './raids/bwl'
import { mcAggroLossBuffs } from './raids/mc'
import { zgAggroLossBuffs } from './raids/zg'

describe('anniversary raid spell organization', () => {
  it('keeps bwl aggro-loss buffs in the bwl module', () => {
    expect(bwlAggroLossBuffs).toEqual(
      new Set([23023, 23310, 23311, 23312, 22289, 23603]),
    )
  })

  it('keeps mc aggro-loss buffs in the mc module', () => {
    expect(mcAggroLossBuffs).toEqual(new Set([20604]))
  })

  it('keeps zg aggro-loss buffs in the zg module', () => {
    expect(zgAggroLossBuffs).toEqual(new Set([24327]))
  })

  it('keeps aq40 aggro-loss buffs in the aq40 module', () => {
    expect(aq40AggroLossBuffs).toEqual(new Set([26580]))
  })

  it('keeps aq40 aura modifiers in the aq40 module', () => {
    expect(Object.keys(aq40AuraModifiers)).toEqual(['26400'])
  })

  it('composes all raid aggro-loss buffs in anniversary config', () => {
    expect(anniversaryConfig.aggroLossBuffs).toEqual(
      new Set([23023, 23310, 23311, 23312, 22289, 23603, 20604, 24327, 26580]),
    )
  })

  it('composes aq40 aura modifiers in anniversary config', () => {
    expect(Object.keys(anniversaryConfig.auraModifiers)).toEqual(['26400'])
  })
})
