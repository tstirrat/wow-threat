/**
 * Season of Discovery Threat Configuration
 *
 * Stub config for gameVersion: 2
 * TODO: Implement SoD-specific runes and mechanics
 */

import type { ThreatConfig, ThreatContext, ThreatFormulaResult } from '../types'

// Placeholder base threat (same as Anniversary for now)
const baseThreat = {
  damage: (ctx: ThreatContext): ThreatFormulaResult => ({
    formula: 'amt',
    baseThreat: ctx.amount,
    modifiers: [],
    splitAmongEnemies: false,
  }),

  heal: (ctx: ThreatContext): ThreatFormulaResult => ({
    formula: 'effectiveHeal * 0.5',
    baseThreat: ctx.amount * 0.5,
    modifiers: [],
    splitAmongEnemies: true,
  }),

  energize: (ctx: ThreatContext): ThreatFormulaResult => ({
    formula: 'resource * 0.5',
    baseThreat: ctx.amount * 0.5,
    modifiers: [],
    splitAmongEnemies: true,
  }),
}

export const sodConfig: ThreatConfig = {
  version: '0.1.0',
  gameVersion: 2,

  baseThreat,

  classes: {
    // TODO: Implement SoD class configs with runes
  },

  auraModifiers: {},
  untauntableEnemies: new Set(),
}
