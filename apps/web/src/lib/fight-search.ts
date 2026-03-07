/**
 * Fuzzy fight search helpers for report/fight quick-switch keyboard picker.
 */
import type { ReportFightSummary } from '../types/api'
import { resolveFuzzyMatchScore } from './player-search'

export interface FightSearchOption {
  id: number
  name: string
  kill: boolean
}

export function buildFightSearchOptions(
  fights: ReportFightSummary[],
): FightSearchOption[] {
  return fights.map((fight) => ({
    id: fight.id,
    name: fight.name,
    kill: fight.kill,
  }))
}

/** Filter and rank fight options by exact, prefix, then fuzzy name matches. */
export function filterFightSearchOptions(
  options: FightSearchOption[],
  rawQuery: string,
): FightSearchOption[] {
  const query = rawQuery.trim()
  if (query.length === 0) {
    return options
  }

  return options
    .map((option, index) => ({
      option,
      index,
      score: resolveFuzzyMatchScore(query, option.name),
    }))
    .filter(
      (
        item,
      ): item is { option: FightSearchOption; index: number; score: number } =>
        item.score !== null,
    )
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score
      }

      return left.index - right.index
    })
    .map((item) => item.option)
}
