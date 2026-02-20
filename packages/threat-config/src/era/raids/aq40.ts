/**
 * Temple of Ahn'Qiraj Raid Config
 *
 * Raid-specific spell sets and encounter rules for AQ40.
 */
import type { SpellId, ThreatContext, ThreatModifier } from '@wow-threat/shared'

export const Spells = {
  YaujFear: 26580,
  FetishOfTheSandReaver: 26400,
}

/**
 * Aggro-loss buffs from Temple of Ahn'Qiraj bosses.
 */
export const aq40AggroLossBuffs: ReadonlySet<SpellId> = new Set([
  Spells.YaujFear, // Princess Yauj: Fear
])

/**
 * Aura modifiers from Temple of Ahn'Qiraj items.
 */
export const aq40AuraModifiers: Record<
  SpellId,
  (ctx: ThreatContext) => ThreatModifier
> = {
  [Spells.FetishOfTheSandReaver]: () => ({
    source: 'gear',
    name: 'Fetish of the Sand Reaver',
    value: 0.3,
  }),
}
