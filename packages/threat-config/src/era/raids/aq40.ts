/**
 * Temple of Ahn'Qiraj Raid Config
 *
 * Raid-specific spell sets and encounter rules for AQ40.
 */
import type {
  SpellId,
  ThreatContext,
  ThreatModifier,
} from '@wcl-threat/shared'

/**
 * Aggro-loss buffs from Temple of Ahn'Qiraj bosses.
 */
export const aq40AggroLossBuffs: ReadonlySet<SpellId> = new Set([
  26580, // Princess Yauj: Fear
])

/**
 * Aura modifiers from Temple of Ahn'Qiraj items.
 */
export const aq40AuraModifiers: Record<
  SpellId,
  (ctx: ThreatContext) => ThreatModifier
> = {
  // Fetish of the Sand Reaver - 0.3x threat
  26400: () => ({
    source: 'gear',
    name: 'Fetish of the Sand Reaver',
    value: 0.3,
  }),
}
