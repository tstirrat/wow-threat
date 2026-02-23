/**
 * Fight page series selection and ordering helpers.
 */
import type { ThreatSeries } from '../types/app'

function isTotemPetSeries(series: ThreatSeries): boolean {
  return series.actorType === 'Pet' && /\btotem\b/i.test(series.actorName)
}

function sortByMaxThreatDesc(left: ThreatSeries, right: ThreatSeries): number {
  return right.maxThreat - left.maxThreat
}

/** Build legend-visible series ordered by peak threat generated during the fight. */
export function buildVisibleSeriesForLegend(
  allSeries: ThreatSeries[],
  showPets: boolean,
): ThreatSeries[] {
  const players = allSeries
    .filter((series) => series.actorType === 'Player')
    .sort(sortByMaxThreatDesc)

  if (!showPets) {
    return players
  }

  const pets = allSeries.filter(
    (series) => series.actorType === 'Pet' && !isTotemPetSeries(series),
  )
  const petsByOwner = pets.reduce<Map<number, ThreatSeries[]>>((map, pet) => {
    if (pet.ownerId === null) {
      return map
    }

    const ownerPets = map.get(pet.ownerId) ?? []
    map.set(pet.ownerId, [...ownerPets, pet])
    return map
  }, new Map<number, ThreatSeries[]>())
  const petsWithoutOwner = pets.filter((pet) => pet.ownerId === null)

  const groupedByOwner = players.flatMap((player) => {
    const ownerPets = (petsByOwner.get(player.actorId) ?? []).sort(
      sortByMaxThreatDesc,
    )
    return [player, ...ownerPets]
  })

  return [...groupedByOwner, ...petsWithoutOwner.sort(sortByMaxThreatDesc)]
}
