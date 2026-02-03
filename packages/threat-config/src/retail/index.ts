/**
 * Retail Threat Configuration
 *
 * Stub config for gameVersion: 3
 * TODO: Implement Retail mechanics (very different from Classic)
 */

import type { ThreatConfig, ThreatContext, ThreatFormulaResult } from '../types'

// Retail threat is significantly simpler - tanks generate much more threat
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

export const retailConfig: ThreatConfig = {
  version: '0.1.0',
  gameVersion: 3,

  baseThreat,

  classes: {
    // TODO: Implement Retail class configs
    // Note: Tank threat multipliers are much higher in Retail
  },

  auraModifiers: {},
  untauntableEnemies: new Set(),
}
