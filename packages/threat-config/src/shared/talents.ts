/**
 * Shared talent-rank inference helpers
 *
 * Utilities in this module normalize and clamp inferred talent ranks so class
 * configs can consistently derive synthetic aura IDs from combatant info data.
 */
import type { TalentImplicationContext } from '@wow-threat/shared'

/**
 * Clamp a rank value to the valid interval [0, maxRank].
 */
export function clampRank(rank: number, maxRank: number): number {
  return Math.max(0, Math.min(maxRank, Math.trunc(rank)))
}

/**
 * Infer a talent from explicit talentRanks or tree point distribution.
 *
 * First checks explicit talentRanks for any rank in the rankSpellIds array.
 * If not found and a treePredicate is provided, uses it to infer the rank
 * from talentPoints distribution (common in legacy/era logs).
 *
 * Returns the spellId at the inferred rank, or undefined if no talent found.
 *
 * @param ctx - TalentImplicationContext containing talentRanks and talentPoints
 * @param rankSpellIds - Array of spellIds ordered by rank [rank1, rank2, ..., rankN]
 * @param treePredicate - Optional predicate that returns a rank (0 = no talent) based on tree points
 *
 * @example
 * // Infer from explicit talentRanks only
 * const spellId = inferTalent(ctx, [Spells.Rank1, Spells.Rank2, Spells.Rank3])
 *
 * @example
 * // Infer from tree points as fallback
 * const spellId = inferTalent(
 *   ctx,
 *   [Spells.Rank1, Spells.Rank2, Spells.Rank3],
 *   (points) => points[1] >= 13 ? 3 : 0,
 * )
 */
export function inferTalent(
  ctx: TalentImplicationContext,
  rankSpellIds: readonly number[],
  treePredicate?: (points: readonly [number, number, number]) => number,
): number | undefined {
  // Find entries in talentRanks that match rankSpellIds
  // If any has rank > 1, use that rank to index into the array
  // Otherwise, return the highest spellId from matching entries

  let highestRank = 0
  let highestSpellId: number | undefined = undefined

  for (let i = 0; i < rankSpellIds.length; i++) {
    const spellId = rankSpellIds[i] as number
    const rank = ctx.talentRanks.get(spellId)

    if (rank !== undefined && rank > 0) {
      // Track highest rank for indexing
      if (rank > highestRank) {
        highestRank = rank
      }
      // Track highest spellId for fallback
      if (highestSpellId === undefined || spellId > highestSpellId) {
        highestSpellId = spellId
      }
    }
  }

  if (highestRank > 1) {
    // If rank > 1, use the rank to index into the array
    const index = Math.min(highestRank, rankSpellIds.length) - 1
    return rankSpellIds[index] as number
  }

  if (highestSpellId !== undefined) {
    // If rank is 1 (or we only have rank 1 entries), return the highest spellId
    return highestSpellId
  }

  if (treePredicate === undefined) {
    return undefined
  }

  const treePoints: readonly [number, number, number] = [
    ctx.talentPoints[0] ?? 0,
    ctx.talentPoints[1] ?? 0,
    ctx.talentPoints[2] ?? 0,
  ]
  const inferredRank = treePredicate(treePoints)
  if (inferredRank <= 0) {
    return undefined
  }

  const rankIndex = inferredRank - 1
  if (rankIndex < 0 || rankIndex >= rankSpellIds.length) {
    return undefined
  }

  return rankSpellIds[rankIndex] as number
}
