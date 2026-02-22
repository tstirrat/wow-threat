/**
 * Anniversary paladin deltas over Era.
 *
 * Adds TBC ranks/abilities and TBC-specific talent behavior.
 */
import type {
  ClassThreatConfig,
  SpellId,
  TalentImplicationContext,
} from '@wow-threat/shared'

import {
  Spells as EraSpells,
  paladinConfig as eraPaladinConfig,
  hasRighteousFuryAura,
} from '../../era/classes/paladin'
import {
  noThreat,
  tauntTarget,
  threat,
  threatOnBuff,
  threatOnBuffOrDamage,
} from '../../shared/formulas'
import { inferTalent } from '../../shared/talents'

export const Spells = {
  ...EraSpells,
  GreaterBlessingOfMightR2: 25782, // https://www.wowhead.com/tbc/spell=25782/
  BlessingOfMightR8: 27140, // https://www.wowhead.com/tbc/spell=27140/
  GreaterBlessingOfMightR3: 27141, // https://www.wowhead.com/tbc/spell=27141/
  BlessingOfWisdomR7: 27142, // https://www.wowhead.com/tbc/spell=27142/
  GreaterBlessingOfWisdomR3: 27143, // https://www.wowhead.com/tbc/spell=27143/
  BlessingOfLightR4: 27144, // https://www.wowhead.com/tbc/spell=27144/
  GreaterBlessingOfLightR2: 27145, // https://www.wowhead.com/tbc/spell=27145/
  BlessingOfSanctuaryR5: 27168, // https://www.wowhead.com/tbc/spell=27168/
  GreaterBlessingOfSanctuaryR2: 27169, // https://www.wowhead.com/tbc/spell=27169/

  SealOfRighteousnessR9: 27155, // https://www.wowhead.com/tbc/spell=27155/
  HolyShieldR1: 20925, // https://www.wowhead.com/tbc/spell=20925/
  HolyShieldR2: 20927, // https://www.wowhead.com/tbc/spell=20927/
  HolyShieldR3: 20928, // https://www.wowhead.com/tbc/spell=20928/
  HolyShieldR4: 27179, // https://www.wowhead.com/tbc/spell=27179/
  AvengersShieldR1: 31935, // https://www.wowhead.com/tbc/spell=31935/
  AvengersShieldR2: 32699, // https://www.wowhead.com/tbc/spell=32699/
  AvengersShieldR3: 32700, // https://www.wowhead.com/tbc/spell=32700/
  RighteousDefense: 31789, // https://www.wowhead.com/tbc/spell=31789/
  SpiritualAttunement: 31786, // https://www.wowhead.com/tbc/spell=31786/

  JudgementOfWisdomManaR1: 20268, // https://www.wowhead.com/tbc/spell=20268/
  JudgementOfWisdomManaR2: 20352, // https://www.wowhead.com/tbc/spell=20352/
  JudgementOfWisdomManaR3: 20353, // https://www.wowhead.com/tbc/spell=20353/
  JudgementOfWisdomManaR4: 27165, // https://www.wowhead.com/tbc/spell=27165/

  HolyLightR10: 27135, // https://www.wowhead.com/tbc/spell=27135/
  HolyLightR11: 27136, // https://www.wowhead.com/tbc/spell=27136/
  FlashOfLightR7: 27137, // https://www.wowhead.com/tbc/spell=27137/
} as const

const IMPROVED_RF_RANKS = [
  Spells.ImprovedRighteousFuryR1,
  Spells.ImprovedRighteousFuryR2,
  Spells.ImprovedRighteousFuryR3,
] as const

const FANATICISM_RANKS = [
  Spells.VengeanceR1,
  Spells.VengeanceR2,
  Spells.VengeanceR3,
  Spells.VengeanceR4,
  Spells.VengeanceR5,
] as const

const PROT = 1
const RET = 2
const IMP_RF_THRESHOLD = 13
const FANATICISM_THRESHOLD = 40

function buildAuraImplications(): Map<SpellId, ReadonlySet<SpellId>> {
  const merged = new Map<SpellId, ReadonlySet<SpellId>>(
    eraPaladinConfig.auraImplications ?? [],
  )
  const rfImplied = new Set(merged.get(Spells.RighteousFury) ?? [])
  rfImplied.add(Spells.HolyShieldR4)
  merged.set(Spells.RighteousFury, rfImplied)
  return merged
}

const noThreatFormula = noThreat()

export const paladinConfig: ClassThreatConfig = {
  ...eraPaladinConfig,
  auraImplications: buildAuraImplications(),

  auraModifiers: {
    ...eraPaladinConfig.auraModifiers,

    [Spells.VengeanceR1]: (ctx) => ({
      source: 'talent',
      name: 'Fanaticism (Rank 1)',
      value: hasRighteousFuryAura(ctx.sourceAuras) ? 1 : 0.94,
    }),
    [Spells.VengeanceR2]: (ctx) => ({
      source: 'talent',
      name: 'Fanaticism (Rank 2)',
      value: hasRighteousFuryAura(ctx.sourceAuras) ? 1 : 0.88,
    }),
    [Spells.VengeanceR3]: (ctx) => ({
      source: 'talent',
      name: 'Fanaticism (Rank 3)',
      value: hasRighteousFuryAura(ctx.sourceAuras) ? 1 : 0.82,
    }),
    [Spells.VengeanceR4]: (ctx) => ({
      source: 'talent',
      name: 'Fanaticism (Rank 4)',
      value: hasRighteousFuryAura(ctx.sourceAuras) ? 1 : 0.76,
    }),
    [Spells.VengeanceR5]: (ctx) => ({
      source: 'talent',
      name: 'Fanaticism (Rank 5)',
      value: hasRighteousFuryAura(ctx.sourceAuras) ? 1 : 0.7,
    }),
  },

  abilities: {
    ...eraPaladinConfig.abilities,

    [Spells.GreaterBlessingOfMightR2]: threatOnBuff(60),
    [Spells.BlessingOfMightR8]: threatOnBuff(70),
    [Spells.GreaterBlessingOfMightR3]: threatOnBuff(70),
    [Spells.BlessingOfWisdomR7]: threatOnBuff(70),
    [Spells.GreaterBlessingOfWisdomR3]: threatOnBuff(70),
    [Spells.BlessingOfLightR4]: threatOnBuff(69),
    [Spells.GreaterBlessingOfLightR2]: threatOnBuff(69),
    [Spells.GreaterBlessingOfSanctuaryR2]: threatOnBuff(70),

    [Spells.SealOfRighteousnessR9]: threatOnBuffOrDamage(58),

    [Spells.HolyShieldR1]: threat({ modifier: 1.35 }),
    [Spells.HolyShieldR2]: threat({ modifier: 1.35 }),
    [Spells.HolyShieldR3]: threat({ modifier: 1.35 }),
    [Spells.HolyShieldR4]: threat({ modifier: 1.35 }),

    [Spells.AvengersShieldR1]: threat({ modifier: 1.3 }),
    [Spells.AvengersShieldR2]: threat({ modifier: 1.3 }),
    [Spells.AvengersShieldR3]: threat({ modifier: 1.3 }),

    [Spells.RighteousDefense]: tauntTarget({ bonus: 0, eventTypes: ['cast'] }),

    [Spells.JudgementOfWisdomManaR1]: noThreatFormula,
    [Spells.JudgementOfWisdomManaR2]: noThreatFormula,
    [Spells.JudgementOfWisdomManaR3]: noThreatFormula,
    [Spells.JudgementOfWisdomManaR4]: noThreatFormula,

    [Spells.HolyLightR10]: threat({
      modifier: 0.5,
      split: true,
      eventTypes: ['heal'],
    }),
    [Spells.HolyLightR11]: threat({
      modifier: 0.5,
      split: true,
      eventTypes: ['heal'],
    }),
    [Spells.FlashOfLightR7]: threat({
      modifier: 0.5,
      split: true,
      eventTypes: ['heal'],
    }),
  },

  talentImplications: (ctx: TalentImplicationContext): SpellId[] => {
    const inferredAuras: SpellId[] = []

    const impRf = inferTalent(ctx, IMPROVED_RF_RANKS, (points) =>
      points[PROT] >= IMP_RF_THRESHOLD ? IMPROVED_RF_RANKS.length : 0,
    )
    if (impRf) {
      inferredAuras.push(impRf as SpellId)
    }

    const fanaticism = inferTalent(ctx, FANATICISM_RANKS, (points) =>
      points[RET] >= FANATICISM_THRESHOLD ? FANATICISM_RANKS.length : 0,
    )
    if (fanaticism) {
      inferredAuras.push(fanaticism as SpellId)
    }

    return inferredAuras
  },
}
