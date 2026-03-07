/**
 * Fuzzy target search helpers used by fight-page keyboard interactions.
 */
import { resolveFuzzyMatchScore } from './player-search'

export interface TargetSearchOption {
  id: number
  instance: number
  key: string
  name: string
  label: string
  isBoss: boolean
}

type MatchTier = 0 | 1 | 2

function resolveMatchTier(score: number): MatchTier {
  if (score >= 5000) {
    return 0
  }

  if (score >= 4000) {
    return 1
  }

  return 2
}

/** Filter and rank target search options with exact/prefix/fuzzy match priority. */
export function filterTargetSearchOptions(
  options: TargetSearchOption[],
  query: string,
): TargetSearchOption[] {
  const normalizedQuery = query.trim()
  if (normalizedQuery.length === 0) {
    return [...options].sort((left, right) => {
      if (left.isBoss !== right.isBoss) {
        return left.isBoss ? -1 : 1
      }

      return 0
    })
  }

  return options
    .map((option, index) => {
      const nameScore = resolveFuzzyMatchScore(normalizedQuery, option.name)
      const labelScore = resolveFuzzyMatchScore(normalizedQuery, option.label)
      const score =
        nameScore === null
          ? labelScore
          : labelScore === null
            ? nameScore
            : Math.max(nameScore, labelScore)

      if (score === null) {
        return {
          index,
          option,
          score,
          tier: null,
        }
      }

      return {
        index,
        option,
        score,
        tier: resolveMatchTier(score),
      }
    })
    .filter(
      (
        item,
      ): item is {
        option: TargetSearchOption
        index: number
        score: number
        tier: MatchTier
      } => item.score !== null && item.tier !== null,
    )
    .sort((left, right) => {
      if (left.tier !== right.tier) {
        return left.tier - right.tier
      }

      if (left.option.isBoss !== right.option.isBoss) {
        return left.option.isBoss ? -1 : 1
      }

      if (left.score !== right.score) {
        return right.score - left.score
      }

      return left.index - right.index
    })
    .map((item) => item.option)
}
