/**
 * Tests for Anniversary inheritance from Era defaults.
 */
import { describe, expect, it } from 'vitest'

import { warriorConfig as anniversaryWarriorConfig } from './classes/warrior'
import { baseThreat as anniversaryBaseThreat } from './general'
import { aq40AuraModifiers as anniversaryAq40AuraModifiers } from './raids/aq40'
import { naxxAbilities as anniversaryNaxxAbilities } from './raids/naxx'
import { onyxiaAbilities as anniversaryOnyxiaAbilities } from './raids/ony'
import { warriorConfig as eraWarriorConfig } from '../era/classes/warrior'
import { baseThreat as eraBaseThreat } from '../era/general'
import { aq40AuraModifiers as eraAq40AuraModifiers } from '../era/raids/aq40'
import { naxxAbilities as eraNaxxAbilities } from '../era/raids/naxx'
import { onyxiaAbilities as eraOnyxiaAbilities } from '../era/raids/ony'

describe('anniversary inheritance defaults', () => {
  it('shares baseThreat with era', () => {
    expect(anniversaryBaseThreat).toBe(eraBaseThreat)
  })

  it('shares onyxia abilities with era', () => {
    expect(anniversaryOnyxiaAbilities).toBe(eraOnyxiaAbilities)
  })

  it('shares naxx abilities with era', () => {
    expect(anniversaryNaxxAbilities).toBe(eraNaxxAbilities)
  })

  it('shares aq40 aura modifiers with era', () => {
    expect(anniversaryAq40AuraModifiers).toBe(eraAq40AuraModifiers)
  })

  it('shares warrior class config with era', () => {
    expect(anniversaryWarriorConfig).toBe(eraWarriorConfig)
  })
})
