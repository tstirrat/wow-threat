/**
 * Fuzzy player search helpers used by fight-page slash command interactions.
 */
import type { ThreatSeries } from '../types/app'

export interface PlayerSearchOption {
  actorId: number
  label: string
  color: string
  isTank: boolean
  aliases: string[]
}

const specialLatinCharacterMap: Record<string, string> = {
  ß: 'b',
  ð: 'o',
  ø: 'o',
  þ: 'p',
  æ: 'ae',
  œ: 'oe',
  ł: 'l',
  đ: 'd',
  ħ: 'h',
  ı: 'i',
  ſ: 's',
}

function transliterateSpecialLatinCharacters(value: string): string {
  return [...value]
    .map((character) => specialLatinCharacterMap[character] ?? character)
    .join('')
}

function normalizeSearchText(value: string): string {
  const baseValue = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, '')

  return transliterateSpecialLatinCharacters(baseValue)
}

function resolveSubsequenceMatchScore(
  query: string,
  target: string,
): number | null {
  let queryIndex = 0
  let score = 0
  let consecutiveMatches = 0

  for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
    if (queryIndex >= query.length) {
      break
    }

    if (target[targetIndex] !== query[queryIndex]) {
      consecutiveMatches = 0
      continue
    }

    queryIndex += 1
    consecutiveMatches += 1
    score += 22 + consecutiveMatches * 6
  }

  if (queryIndex !== query.length) {
    return null
  }

  return 1000 + score - (target.length - query.length) * 3
}

/** Return a fuzzy-match score for a query and target label, or null when unmatched. */
export function resolveFuzzyMatchScore(
  rawQuery: string,
  rawTarget: string,
): number | null {
  const query = normalizeSearchText(rawQuery)
  if (query.length === 0) {
    return 0
  }

  const target = normalizeSearchText(rawTarget)
  if (target.length === 0) {
    return null
  }

  if (target === query) {
    return 5000
  }

  if (target.startsWith(query)) {
    return 4000 - (target.length - query.length) * 2
  }

  const containsIndex = target.indexOf(query)
  if (containsIndex >= 0) {
    return 3000 - containsIndex * 4
  }

  return resolveSubsequenceMatchScore(query, target)
}

/** Build stable player-only search options from chart series in display order. */
export function buildPlayerSearchOptions(
  series: ThreatSeries[],
): PlayerSearchOption[] {
  const seenPlayerIds = new Set<number>()

  return series.reduce<PlayerSearchOption[]>((options, item) => {
    if (item.actorType !== 'Player' || seenPlayerIds.has(item.actorId)) {
      return options
    }

    seenPlayerIds.add(item.actorId)
    const aliases = new Set<string>([item.label, item.actorName])
    return [
      ...options,
      {
        actorId: item.actorId,
        label: item.label,
        color: item.color,
        isTank: item.actorRole === 'Tank',
        aliases: [...aliases],
      },
    ]
  }, [])
}

/** Filter and rank player search options by fuzzy score using label and aliases. */
export function filterPlayerSearchOptions(
  options: PlayerSearchOption[],
  rawQuery: string,
): PlayerSearchOption[] {
  const query = normalizeSearchText(rawQuery)
  if (query.length === 0) {
    return options
  }

  return options
    .map((option, index) => {
      const score = option.aliases.reduce<number | null>((bestScore, alias) => {
        const aliasScore = resolveFuzzyMatchScore(query, alias)
        if (aliasScore === null) {
          return bestScore
        }

        if (bestScore === null || aliasScore > bestScore) {
          return aliasScore
        }

        return bestScore
      }, null)

      return {
        option,
        index,
        score,
      }
    })
    .filter(
      (
        item,
      ): item is { option: PlayerSearchOption; index: number; score: number } =>
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
