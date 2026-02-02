/**
 * Anniversary Edition Threat Configuration
 *
 * This is the main entry point for Anniversary Edition (gameVersion: 1) threat config.
 */

import type { ThreatConfig } from '../types'
import { baseThreat } from './general'
import { warriorConfig } from './classes/warrior'
import { paladinConfig } from './classes/paladin'

// Creature GUIDs that cannot be taunted
const untauntableEnemies = new Set<number>([
  // Add boss GUIDs here as needed
  // e.g., 15990 for Kel'Thuzad during certain phases
])

export const anniversaryConfig: ThreatConfig = {
  version: '1.0.0',
  gameVersion: 1, // WCL gameVersion integer

  baseThreat,

  classes: {
    warrior: warriorConfig,
    paladin: paladinConfig,
    // TODO: Add other classes
    // druid: druidConfig,
    // priest: priestConfig,
    // rogue: rogueConfig,
    // hunter: hunterConfig,
    // mage: mageConfig,
    // warlock: warlockConfig,
    // shaman: shamanConfig,
  },

  untauntableEnemies,
}
