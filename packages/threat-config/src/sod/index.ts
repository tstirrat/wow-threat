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
    value: ctx.amount,
    splitAmongEnemies: false,
  }),

  heal: (ctx: ThreatContext): ThreatFormulaResult => ({
    formula: 'effectiveHeal * 0.5',
    value: ctx.amount * 0.5,
    splitAmongEnemies: true,
  }),

  energize: (ctx: ThreatContext): ThreatFormulaResult => ({
    formula: 'resource * 0.5',
    value: ctx.amount * 0.5,
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
}
