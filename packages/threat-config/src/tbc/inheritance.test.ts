/**
 * Tests for Anniversary inheritance from Era defaults.
 */
import { describe, expect, it } from 'vitest'

import { anniversaryConfig } from '.'
import { druidConfig as eraDruidConfig } from '../era/classes/druid'
import { hunterConfig as eraHunterConfig } from '../era/classes/hunter'
import { mageConfig as eraMageConfig } from '../era/classes/mage'
import { paladinConfig as eraPaladinConfig } from '../era/classes/paladin'
import { priestConfig as eraPriestConfig } from '../era/classes/priest'
import { rogueConfig as eraRogueConfig } from '../era/classes/rogue'
import { shamanConfig as eraShamanConfig } from '../era/classes/shaman'
import { warlockConfig as eraWarlockConfig } from '../era/classes/warlock'
import {
  warriorConfig as eraWarriorConfig,
  Spells as eraWarriorSpells,
} from '../era/classes/warrior'
import { baseThreat as eraBaseThreat } from '../era/general'
import {
  aq40AggroLossBuffs as eraAq40AggroLossBuffs,
  aq40AuraModifiers as eraAq40AuraModifiers,
} from '../era/raids/aq40'
import {
  bwlAbilities as eraBwlAbilities,
  bwlAggroLossBuffs as eraBwlAggroLossBuffs,
} from '../era/raids/bwl'
import { mcAggroLossBuffs as eraMcAggroLossBuffs } from '../era/raids/mc'
import { naxxAbilities as eraNaxxAbilities } from '../era/raids/naxx'
import { onyxiaAbilities as eraOnyxiaAbilities } from '../era/raids/ony'
import {
  zgAggroLossBuffs as eraZgAggroLossBuffs,
  zgEncounters as eraZgEncounters,
} from '../era/raids/zg'
import { druidConfig as anniversaryDruidConfig } from './classes/druid'
import { hunterConfig as anniversaryHunterConfig } from './classes/hunter'
import { mageConfig as anniversaryMageConfig } from './classes/mage'
import { paladinConfig as anniversaryPaladinConfig } from './classes/paladin'
import { priestConfig as anniversaryPriestConfig } from './classes/priest'
import { rogueConfig as anniversaryRogueConfig } from './classes/rogue'
import { shamanConfig as anniversaryShamanConfig } from './classes/shaman'
import { warlockConfig as anniversaryWarlockConfig } from './classes/warlock'
import {
  warriorConfig as anniversaryWarriorConfig,
  Spells as anniversaryWarriorSpells,
} from './classes/warrior'
import {
  aq40AggroLossBuffs as anniversaryAq40AggroLossBuffs,
  aq40AuraModifiers as anniversaryAq40AuraModifiers,
} from './raids/aq40'
import {
  bwlAbilities as anniversaryBwlAbilities,
  bwlAggroLossBuffs as anniversaryBwlAggroLossBuffs,
} from './raids/bwl'
import { mcAggroLossBuffs as anniversaryMcAggroLossBuffs } from './raids/mc'
import { naxxAbilities as anniversaryNaxxAbilities } from './raids/naxx'
import { onyxiaAbilities as anniversaryOnyxiaAbilities } from './raids/ony'
import {
  zgAggroLossBuffs as anniversaryZgAggroLossBuffs,
  zgEncounters as anniversaryZgEncounters,
} from './raids/zg'

describe('anniversary inheritance defaults', () => {
  it('shares baseThreat with era', () => {
    expect(anniversaryConfig.baseThreat).toBe(eraBaseThreat)
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

  it('shares class configs with era', () => {
    expect(anniversaryDruidConfig).toBe(eraDruidConfig)
    expect(anniversaryHunterConfig).toBe(eraHunterConfig)
    expect(anniversaryMageConfig).toBe(eraMageConfig)
    expect(anniversaryPaladinConfig).toBe(eraPaladinConfig)
    expect(anniversaryPriestConfig).toBe(eraPriestConfig)
    expect(anniversaryRogueConfig).toBe(eraRogueConfig)
    expect(anniversaryShamanConfig).toBe(eraShamanConfig)
    expect(anniversaryWarlockConfig).toBe(eraWarlockConfig)
    // Anniversary warrior extends era with TBC-specific ranks.
    expect(anniversaryWarriorConfig).not.toBe(eraWarriorConfig)
    expect(
      anniversaryWarriorConfig.abilities?.[eraWarriorSpells.SunderArmorR5],
    ).toBe(eraWarriorConfig.abilities[eraWarriorSpells.SunderArmorR5])
    expect(
      anniversaryWarriorConfig.abilities?.[
        anniversaryWarriorSpells.SunderArmorR6
      ],
    ).toBeDefined()
  })

  it('shares era raid wrappers with era exports', () => {
    expect(anniversaryAq40AggroLossBuffs).toBe(eraAq40AggroLossBuffs)
    expect(anniversaryAq40AuraModifiers).toBe(eraAq40AuraModifiers)
    expect(anniversaryBwlAbilities).toBe(eraBwlAbilities)
    expect(anniversaryBwlAggroLossBuffs).toBe(eraBwlAggroLossBuffs)
    expect(anniversaryMcAggroLossBuffs).toBe(eraMcAggroLossBuffs)
    expect(anniversaryZgAggroLossBuffs).toBe(eraZgAggroLossBuffs)
    expect(anniversaryZgEncounters).toBe(eraZgEncounters)
  })

  it('keeps inherited era handlers present in anniversary config', () => {
    expect(anniversaryConfig.abilities?.[18670]).toBe(eraBwlAbilities[18670])
    expect(anniversaryConfig.abilities?.[23397]).toBe(eraBwlAbilities[23397])
    expect(anniversaryConfig.abilities?.[23398]).toBe(eraBwlAbilities[23398])
    expect(anniversaryConfig.auraModifiers?.[26400]).toBe(
      eraAq40AuraModifiers[26400],
    )
  })
})
