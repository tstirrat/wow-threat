/**
 * Anniversary shaman deltas over Era.
 *
 * Adds TBC talent modifiers and TBC-only rank behavior.
 */
import type {
  ClassThreatConfig,
  SpellId,
  TalentImplicationContext,
  ThreatFormula,
} from '@wcl-threat/shared'
import { SpellSchool } from '@wcl-threat/shared'

import {
  Spells as EraSpells,
  shamanConfig as eraShamanConfig,
} from '../../era/classes/shaman'
import { calculateThreat, noThreat } from '../../shared/formulas'
import { inferTalent } from '../../shared/talents'

export const Spells = {
  ...EraSpells,
  EarthShockR8: 25454,
  FrostShockR1: 8056,
  FrostShockR2: 8058,
  FrostShockR3: 10472,
  FrostShockR4: 10473,
  FrostShockR5: 25464,

  Clearcasting: 16246,
  WindfuryAttackR1: 8516,
  WindfuryAttackR2: 10608,
  WindfuryAttackR3: 10610,
  WindfuryAttackR4: 25584,
  UnleashedRageR1: 30802,
  UnleashedRageR2: 30807,
  ShamanisticRageCast: 30823,
  ShamanisticRageBuff: 30824,
  Flurry: 16280,
  WaterShieldCastR1: 24398,
  WaterShieldCastR2: 33736,
  WaterShieldManaR1: 23575,
  WaterShieldManaR2: 33737,
  TotemicCall: 39104,
  LightningOverloadR1: 45284,
  LightningOverloadR2: 45286,
  LightningOverloadR3: 45287,
  LightningOverloadR4: 45288,
  LightningOverloadR5: 45289,
  LightningOverloadR6: 45290,
  LightningOverloadR7: 45291,
  LightningOverloadR8: 45292,
  LightningOverloadR9: 45293,
  LightningOverloadR10: 45294,
  LightningOverloadR11: 45295,
  LightningOverloadR12: 45296,
  ChainLightningOverloadR1: 45297,
  ChainLightningOverloadR2: 45298,
  ChainLightningOverloadR3: 45299,
  ChainLightningOverloadR4: 45300,
  ChainLightningOverloadR5: 45301,
  ChainLightningOverloadR6: 45302,
  ElementalMastery: 16166,

  SpiritWeaponsAura: 910101,
  ElementalPrecisionFireAura: 910111,
  ElementalPrecisionNatureAura: 910112,
  ElementalPrecisionFrostAura: 910113,
} as const

const ELEMENTAL = 0
const ENHANCEMENT = 1

const ELEMENTAL_PRECISION_THRESHOLD = 28
const SPIRIT_WEAPONS_THRESHOLD = 21

const noThreatFormula = noThreat()

const resourceChangeThreat: ThreatFormula = (ctx) => {
  if (ctx.event.type !== 'resourcechange' && ctx.event.type !== 'energize') {
    return undefined
  }

  if (ctx.event.resourceChangeType === 'energy') {
    return {
      formula: '0',
      value: 0,
      splitAmongEnemies: false,
      applyPlayerMultipliers: false,
    }
  }

  const multiplier = ctx.event.resourceChangeType === 'rage' ? 5 : 0.5
  return {
    formula: `${ctx.event.resourceChangeType} * ${multiplier}`,
    value: ctx.amount * multiplier,
    splitAmongEnemies: true,
    applyPlayerMultipliers: false,
  }
}

const LIGHTNING_OVERLOAD_SPELLS = [
  Spells.LightningOverloadR1,
  Spells.LightningOverloadR2,
  Spells.LightningOverloadR3,
  Spells.LightningOverloadR4,
  Spells.LightningOverloadR5,
  Spells.LightningOverloadR6,
  Spells.LightningOverloadR7,
  Spells.LightningOverloadR8,
  Spells.LightningOverloadR9,
  Spells.LightningOverloadR10,
  Spells.LightningOverloadR11,
  Spells.LightningOverloadR12,
  Spells.ChainLightningOverloadR1,
  Spells.ChainLightningOverloadR2,
  Spells.ChainLightningOverloadR3,
  Spells.ChainLightningOverloadR4,
  Spells.ChainLightningOverloadR5,
  Spells.ChainLightningOverloadR6,
] as const

export const shamanConfig: ClassThreatConfig = {
  ...eraShamanConfig,

  auraModifiers: {
    ...eraShamanConfig.auraModifiers,
    [Spells.SpiritWeaponsAura]: () => ({
      source: 'talent',
      name: 'Spirit Weapons',
      value: 0.7,
      schoolMask: SpellSchool.Physical,
    }),
    [Spells.ElementalPrecisionFireAura]: () => ({
      source: 'talent',
      name: 'Elemental Precision (Fire)',
      value: 0.9,
      schoolMask: SpellSchool.Fire,
    }),
    [Spells.ElementalPrecisionNatureAura]: () => ({
      source: 'talent',
      name: 'Elemental Precision (Nature)',
      value: 0.9,
      schoolMask: SpellSchool.Nature,
    }),
    [Spells.ElementalPrecisionFrostAura]: () => ({
      source: 'talent',
      name: 'Elemental Precision (Frost)',
      value: 0.9,
      schoolMask: SpellSchool.Frost,
    }),
  },

  abilities: {
    ...eraShamanConfig.abilities,
    [Spells.EarthShockR1]: calculateThreat({ modifier: 1 }),
    [Spells.EarthShockR2]: calculateThreat({ modifier: 1 }),
    [Spells.EarthShockR3]: calculateThreat({ modifier: 1 }),
    [Spells.EarthShockR4]: calculateThreat({ modifier: 1 }),
    [Spells.EarthShockR5]: calculateThreat({ modifier: 1 }),
    [Spells.EarthShockR6]: calculateThreat({ modifier: 1 }),
    [Spells.EarthShockR7]: calculateThreat({ modifier: 1 }),
    [Spells.EarthShockR8]: calculateThreat({ modifier: 1 }),

    [Spells.FrostShockR1]: calculateThreat({ modifier: 2 }),
    [Spells.FrostShockR2]: calculateThreat({ modifier: 2 }),
    [Spells.FrostShockR3]: calculateThreat({ modifier: 2 }),
    [Spells.FrostShockR4]: calculateThreat({ modifier: 2 }),
    [Spells.FrostShockR5]: calculateThreat({ modifier: 2 }),

    [Spells.Clearcasting]: noThreatFormula,
    [Spells.WindfuryAttackR1]: noThreatFormula,
    [Spells.WindfuryAttackR2]: noThreatFormula,
    [Spells.WindfuryAttackR4]: noThreatFormula,
    [Spells.UnleashedRageR1]: noThreatFormula,
    [Spells.UnleashedRageR2]: noThreatFormula,
    [Spells.ShamanisticRageCast]: noThreatFormula,
    [Spells.ShamanisticRageBuff]: resourceChangeThreat,
    [Spells.Flurry]: noThreatFormula,
    [Spells.WaterShieldCastR1]: noThreatFormula,
    [Spells.WaterShieldCastR2]: noThreatFormula,
    [Spells.WaterShieldManaR1]: noThreatFormula,
    [Spells.WaterShieldManaR2]: noThreatFormula,
    [Spells.TotemicCall]: resourceChangeThreat,
    [Spells.ElementalMastery]: noThreatFormula,

    ...Object.fromEntries(
      LIGHTNING_OVERLOAD_SPELLS.map((spellId) => [spellId, noThreatFormula]),
    ),
  },

  talentImplications: (ctx: TalentImplicationContext): SpellId[] => {
    const inferredAuras = [
      ...(eraShamanConfig.talentImplications?.(ctx) ?? []),
    ] as SpellId[]

    const spiritWeapons = inferTalent(
      ctx,
      [Spells.SpiritWeaponsAura],
      (points) => (points[ENHANCEMENT] >= SPIRIT_WEAPONS_THRESHOLD ? 1 : 0),
    )
    if (spiritWeapons) {
      inferredAuras.push(spiritWeapons as SpellId)
    }

    const elementalPrecision = inferTalent(
      ctx,
      [Spells.ElementalPrecisionFireAura],
      (points) => (points[ELEMENTAL] >= ELEMENTAL_PRECISION_THRESHOLD ? 1 : 0),
    )
    if (elementalPrecision) {
      inferredAuras.push(Spells.ElementalPrecisionFireAura)
      inferredAuras.push(Spells.ElementalPrecisionNatureAura)
      inferredAuras.push(Spells.ElementalPrecisionFrostAura)
    }

    return inferredAuras
  },
}
