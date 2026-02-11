/**
 * Mock Threat Config Factory for Tests
 *
 * Provides a minimal, self-contained threat configuration for unit tests.
 * Tests can override specific parts without dependencies on real game configs.
 */
import type { ThreatConfig, ThreatContext } from '../../types'

/**
 * Create a minimal mock threat configuration for testing
 *
 * Default config includes:
 * - Simple base threat formulas (damage 1:1, heal 0.5x, energize 5x)
 * - Warrior (baseThreatFactor 1.0) and Rogue (baseThreatFactor 0.71)
 * - Empty aura modifiers and abilities
 *
 * Override pattern merges at the class level:
 * - Default rogue config is preserved unless explicitly overridden
 * - Tests can add/replace warrior, priest, druid, etc. without re-specifying rogue
 *
 * @example
 * const config = createMockThreatConfig({
 *   classes: {
 *     warrior: {
 *       baseThreatFactor: 1.3,
 *       auraModifiers: { 71: () => ({ ... }) },
 *       abilities: {},
 *     },
 *     priest: {
 *       baseThreatFactor: 1.0,
 *       auraModifiers: {},
 *       abilities: {},
 *     },
 *     // rogue from default is automatically preserved
 *   }
 * })
 */
export function createMockThreatConfig(
  overrides?: Partial<ThreatConfig>,
): ThreatConfig {
  const defaultConfig: ThreatConfig = {
    version: 'test-1.0.0',
    gameVersion: 1,

    baseThreat: {
      damage: (ctx: ThreatContext) => ({
        formula: 'amount',
        value: ctx.amount,
        splitAmongEnemies: false,
      }),
      heal: (ctx: ThreatContext) => ({
        formula: 'amount * 0.5',
        value: ctx.amount * 0.5,
        splitAmongEnemies: true,
      }),
      energize: (ctx: ThreatContext) => ({
        formula: 'amount * 5',
        value: ctx.amount * 5,
        splitAmongEnemies: true,
      }),
    },

    classes: {
      warrior: {
        baseThreatFactor: 1.0,
        auraModifiers: {},
        abilities: {},
      },
      rogue: {
        baseThreatFactor: 0.71,
        auraModifiers: {},
        abilities: {},
      },
    },

    auraModifiers: {},
    fixateBuffs: new Set(),
    aggroLossBuffs: new Set(),
    invulnerabilityBuffs: new Set(),
  }

  return {
    ...defaultConfig,
    ...overrides,
    // Merge classes at the top level to preserve default rogue unless overridden
    classes: {
      ...defaultConfig.classes,
      ...overrides?.classes,
    },
  }
}
