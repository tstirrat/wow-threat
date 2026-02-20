/**
 * Anniversary/TBC global misc ability deltas over Era.
 *
 * Includes consumables, trinkets, engineering bombs, and other non-class,
 * non-raid spell overrides.
 */
import type { ThreatFormula } from '@wow-threat/shared'

import { miscAbilities as eraMisc } from '../era/misc'
import { noThreat, threat, threatOnSuccessfulHit } from '../shared/formulas'

const noThreatFormula = noThreat()

const ZERO_THREAT_SPELLS = [
  35163, // Blessing of the Silver Crescent
  34106, // Armor Pen proc (Blood Furnace)
  35166, // Bloodlust Brooch
  28866, // Kiss of the Spider
  26480, // Badge of the Swarmguard
  26481, // Badge of the Swarmguard (armor pen)
  33649, // Hourglass of the Unraveller
  51955, // Dire Drunkard
  21165, // Blacksmith mace proc
  28093, // Mongoose proc
  28508, // Destruction Potion
  28507, // Haste Potion
  22838, // Haste Potion (legacy ID)
  29529, // Drums of Battle
  35476, // Drums of Battle
  185848, // Greater Drums of Battle
  32182, // Heroism
  2825, // Bloodlust
  28515, // Ironshield Potion
  13455, // Greater Stoneshield Potion
  4623, // Lesser Stoneshield Potion
  27648, // Thunderfury nature proc in TBC
] as const

const ENGINEERING_DAMAGE_SPELLS = [
  30486, // Super Sapper Charge
  39965, // Frost Grenade
  30217, // Adamantite Grenade
  30461, // The Bigger One
  19821, // Arcane Bomb
  30216, // Fel Iron Bomb
  46567, // Rocket Launch
] as const

export const miscAbilities: Record<number, ThreatFormula> = {
  ...eraMisc,

  // Thunderfury behavior differs in TBC.
  21992: threatOnSuccessfulHit({ modifier: 0.5, bonus: 63 }),
  26992: threat({ modifier: 1 }),
  // Upstream redirects this threat to the healed target. The current engine
  // does not expose full enemy iteration in formula context, so this keeps the
  // same threat value while preserving spell coverage.
  379: threat({ modifier: 0.5, split: true, eventTypes: ['heal'] }), // Earth Shield
  33110: threat({ modifier: 0.5, split: true, eventTypes: ['heal'] }), // Prayer of Mending

  ...Object.fromEntries(
    ENGINEERING_DAMAGE_SPELLS.map((spellId) => [
      spellId,
      threat({ modifier: 1 }),
    ]),
  ),
  ...Object.fromEntries(
    ZERO_THREAT_SPELLS.map((spellId) => [spellId, noThreatFormula]),
  ),
}
