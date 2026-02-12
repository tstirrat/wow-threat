/**
 * Vanilla Era Threat Configuration
 *
 * Stub config for Classic Era.
 * TODO: Implement Era-specific mechanics and class configs.
 */
import type {
  ThreatConfig,
  ThreatConfigResolutionInput,
  ThreatContext,
  ThreatFormulaResult,
} from '@wcl-threat/shared'

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

function getClassicSeasonIds(input: ThreatConfigResolutionInput): number[] {
  return Array.from(
    new Set(
      input.fights
        .map((fight) => fight.classicSeasonID)
        .filter((seasonId): seasonId is number => seasonId != null),
    ),
  )
}

function hasEraPartition(input: ThreatConfigResolutionInput): boolean {
  return (input.zone.partitions ?? []).some((partition) => {
    const name = partition.name.toLowerCase()
    return name.includes('s0') || name.includes('hardcore') || name.includes('som')
  })
}

export const eraConfig: ThreatConfig = {
  version: '0.1.0',
  displayName: 'Vanilla (Era)',
  resolve: (input: ThreatConfigResolutionInput): boolean => {
    if (input.gameVersion !== 2) {
      return false
    }

    if (getClassicSeasonIds(input).length > 0) {
      return false
    }

    return hasEraPartition(input)
  },

  baseThreat,

  classes: {
    // TODO: Implement Era class configs
  },

  auraModifiers: {},
}
