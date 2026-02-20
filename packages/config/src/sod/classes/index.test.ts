/**
 * Season of Discovery Class Index Tests
 */
import { describe, expect, it } from 'vitest'

import { druidConfig } from './druid'
import { hunterConfig } from './hunter'
import { sodClasses } from './index'
import { mageConfig } from './mage'
import { paladinConfig } from './paladin'
import { priestConfig } from './priest'
import { rogueConfig } from './rogue'
import { shamanConfig } from './shaman'
import { warlockConfig } from './warlock'
import { warriorConfig } from './warrior'

describe('sod classes index', () => {
  it('maps all class keys to sod class configs', () => {
    expect(sodClasses.warrior).toBe(warriorConfig)
    expect(sodClasses.paladin).toBe(paladinConfig)
    expect(sodClasses.druid).toBe(druidConfig)
    expect(sodClasses.priest).toBe(priestConfig)
    expect(sodClasses.rogue).toBe(rogueConfig)
    expect(sodClasses.hunter).toBe(hunterConfig)
    expect(sodClasses.mage).toBe(mageConfig)
    expect(sodClasses.warlock).toBe(warlockConfig)
    expect(sodClasses.shaman).toBe(shamanConfig)
  })
})
