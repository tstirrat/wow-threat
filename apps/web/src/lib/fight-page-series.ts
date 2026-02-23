/**
 * Fight page series selection and ordering helpers.
 */
import type { ThreatSeries } from '../types/app'

function isTotemPetSeries(series: ThreatSeries): boolean {
  return series.actorType === 'Pet' && /\btotem\b/i.test(series.actorName)
}

/** Build legend-visible series ordered by peak threat generated during the fight. */
export function buildVisibleSeriesForLegend(
  allSeries: ThreatSeries[],
  showPets: boolean,
): ThreatSeries[] {
  return allSeries
    .filter(
      (series) =>
        series.actorType === 'Player' ||
        (showPets && !isTotemPetSeries(series)),
    )
    .sort((a, b) => b.maxThreat - a.maxThreat)
}
