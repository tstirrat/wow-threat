/**
 * Druid Threat Configuration - WoW Forever
 *
 * Forever inherits Era Druid threat rules, then replaces only mechanics that
 * change threat relative to the damage and healing already observed by WCL.
 */
import {
  type ClassThreatConfig,
  SpellSchool,
  type TalentModifierFn,
  type ThreatFormula,
} from '@wow-threat/shared'

import {
  Spells as EraSpells,
  druidConfig as eraDruidConfig,
} from '../../era/classes/druid'
import { threat, threatOnCastRollbackOnMiss } from '../../shared/formulas'

export const Spells = {
  ...EraSpells,

  // Forever server-side tuning
  DruidTuningAura: 436895, // https://www.wowhead.com/forever/spell=436895/

  // Bear abilities
  PrimalBiteR1: 407995, // https://www.wowhead.com/forever/spell=407995/
  PrimalBiteR2: 1238069, // https://www.wowhead.com/forever/spell=1238069/
  PrimalBiteR3: 1238070, // https://www.wowhead.com/forever/spell=1238070/
  PrimalBiteR4: 1238073, // https://www.wowhead.com/forever/spell=1238073/
  LacerateR1: 414644, // https://www.wowhead.com/forever/spell=414644/
  LacerateR2: 1235826, // https://www.wowhead.com/forever/spell=1235826/
  LacerateR3: 1235827, // https://www.wowhead.com/forever/spell=1235827/

  // Restoration talents and affected spells
  Subtlety: 17118, // https://www.wowhead.com/forever/spell=17118/
  ImprovedTranquility: 17123, // https://www.wowhead.com/forever/spell=17123/
  TranquilityR1: 740, // https://www.wowhead.com/forever/spell=740/
  TranquilityR2: 8918, // https://www.wowhead.com/forever/spell=8918/
  TranquilityR3: 9862, // https://www.wowhead.com/forever/spell=9862/
  TranquilityR4: 9863, // https://www.wowhead.com/forever/spell=9863/
} as const

export const ForeverTalentEntries = {
  // TraitNode 104920; TraitDefinition 134381; Spell 17118.
  Subtlety: 129580,
  // TraitNode 104909; TraitDefinition 134370; Spell 17123.
  ImprovedTranquility: 129569,
} as const

const Mods = {
  // Hidden aura 436895 doubles Swipe's 1.75x Era intrinsic threat modifier.
  Swipe: 3.5,
  SubtletyPerRank: 0.1,
  ImprovedTranquilityPerRank: 0.5,
} as const

const TRANQUILITY_SPELL_IDS = new Set([
  Spells.TranquilityR1,
  Spells.TranquilityR2,
  Spells.TranquilityR3,
  Spells.TranquilityR4,
])

function buildAuraImplications(): Map<number, ReadonlySet<number>> {
  const mergedMap = new Map<number, ReadonlySet<number>>(
    eraDruidConfig.auraImplications ?? [],
  )
  const bearAbilities = new Set(mergedMap.get(Spells.DireBearForm) ?? [])
  bearAbilities.add(Spells.PrimalBiteR1)
  bearAbilities.add(Spells.PrimalBiteR2)
  bearAbilities.add(Spells.PrimalBiteR3)
  bearAbilities.add(Spells.PrimalBiteR4)
  bearAbilities.add(Spells.LacerateR1)
  bearAbilities.add(Spells.LacerateR2)
  bearAbilities.add(Spells.LacerateR3)
  mergedMap.set(Spells.DireBearForm, bearAbilities)
  return mergedMap
}

const subtletyModifier: TalentModifierFn = (_ctx, rank) => ({
  source: 'talent',
  name: `Subtlety (Rank ${rank})`,
  value: 1 - Mods.SubtletyPerRank * rank,
  schoolMask: SpellSchool.Nature | SpellSchool.Arcane,
})

const improvedTranquilityModifier: TalentModifierFn = (_ctx, rank) => ({
  source: 'talent',
  name: `Improved Tranquility (Rank ${rank})`,
  value: 1 - Mods.ImprovedTranquilityPerRank * rank,
  spellIds: TRANQUILITY_SPELL_IDS,
})

function unresolvedBonusThreat(note: string): ThreatFormula {
  const baseDamageThreat = threat()

  return (ctx) => {
    const result = baseDamageThreat(ctx)
    return result ? { ...result, note } : undefined
  }
}

const primalBiteThreat = unresolvedBonusThreat(
  'Primal Bite server-side bonus threat unresolved (approximately doubled 2026-10-01)',
)

const lacerateThreat = unresolvedBonusThreat(
  'Lacerate server-side bonus threat unresolved (initial/tick/flat components require WCL testing)',
)

// Copy Era's modifiers so inherited Classic behavior remains immutable.
const auraModifiers: ClassThreatConfig['auraModifiers'] = {
  ...eraDruidConfig.auraModifiers,
}

// Forever Feral Instinct increases Swipe damage rather than Bear threat. WCL
// already reports that damage, so none of Era's rank auras may modify threat.
delete auraModifiers[Spells.FeralInstinctRank1]
delete auraModifiers[Spells.FeralInstinctRank2]
delete auraModifiers[Spells.FeralInstinctRank3]
delete auraModifiers[Spells.FeralInstinctRank4]
delete auraModifiers[Spells.FeralInstinctRank5]

export const foreverDruidConfig: ClassThreatConfig = {
  ...eraDruidConfig,
  auraModifiers,
  auraImplications: buildAuraImplications(),

  abilities: {
    // Intended Era values such as Faerie Fire's +108 and Demoralizing Roar's
    // rank bonuses remain active. Historical beta debuff-threat suppression is
    // not selectable until Forever report metadata exposes a reliable build.
    ...eraDruidConfig.abilities,

    [Spells.SwipeR1]: threat({ modifier: Mods.Swipe }),
    [Spells.SwipeR2]: threat({ modifier: Mods.Swipe }),
    [Spells.SwipeR3]: threat({ modifier: Mods.Swipe }),
    [Spells.SwipeR4]: threat({ modifier: Mods.Swipe }),
    [Spells.SwipeR5]: threat({ modifier: Mods.Swipe }),

    [Spells.CowerR1]: threatOnCastRollbackOnMiss(-480),
    [Spells.CowerR2]: threatOnCastRollbackOnMiss(-780),
    [Spells.CowerR3]: threatOnCastRollbackOnMiss(-1200),

    // Primal Bite has server-side bonus threat in Forever. Blizzard
    // approximately doubled its threat on 2026-10-01. The exact coefficient
    // still requires empirical WCL testing.
    [Spells.PrimalBiteR1]: primalBiteThreat,
    [Spells.PrimalBiteR2]: primalBiteThreat,
    [Spells.PrimalBiteR3]: primalBiteThreat,
    [Spells.PrimalBiteR4]: primalBiteThreat,

    // Lacerate's server-side bonus may affect its application, ticks, flat
    // threat, or a combination. Preserve logged damage threat and flag the
    // unresolved bonus rather than importing SoD/TBC behavior.
    [Spells.LacerateR1]: lacerateThreat,
    [Spells.LacerateR2]: lacerateThreat,
    [Spells.LacerateR3]: lacerateThreat,
  },

  talentModifiers: {
    [ForeverTalentEntries.Subtlety]: {
      spellId: Spells.Subtlety,
      maxRank: 3,
      modifier: subtletyModifier,
    },
    [ForeverTalentEntries.ImprovedTranquility]: {
      spellId: Spells.ImprovedTranquility,
      maxRank: 2,
      modifier: improvedTranquilityModifier,
    },
  },

  // Forever reports exact talent entry ranks. Do not use Era's talent-tree
  // thresholds to infer legacy Feral Instinct or healing-only Subtlety auras.
  talentImplications: () => [],
}
