/**
 * Query parameter parsing and serialization helpers.
 */
import type { FightQueryState } from '../types/app'

function parseInteger(value: string | null): number | null {
  if (!value) {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

/** Parse comma-separated player IDs from query params. */
export function parsePlayersParam(raw: string | null): number[] {
  if (!raw) {
    return []
  }

  return raw
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((id) => Number.isFinite(id))
}

function normalizePlayerIds(playerIds: number[]): number[] {
  return [...new Set(playerIds)].sort((left, right) => left - right)
}

/** Parse a target ID and ensure it exists in the valid target set. */
export function parseTargetIdParam(
  raw: string | null,
  validTargetIds: Set<number>,
): number | null {
  const parsed = parseInteger(raw)
  if (!parsed || !validTargetIds.has(parsed)) {
    return null
  }

  return parsed
}

/** Parse target ID + instance from query params and validate against known target keys. */
export function parseTargetSelectionParams(
  targetIdRaw: string | null,
  targetInstanceRaw: string | null,
  validTargetKeys: Set<string>,
): { targetId: number; targetInstance: number } | null {
  const targetId = parseInteger(targetIdRaw)
  if (!targetId) {
    return null
  }

  const parsedTargetInstance = parseInteger(targetInstanceRaw)
  const targetInstance = parsedTargetInstance ?? 0
  const key = `${targetId}:${targetInstance}`
  if (!validTargetKeys.has(key)) {
    return null
  }

  return {
    targetId,
    targetInstance,
  }
}

/** Parse and validate a chart window from query params. */
export function parseWindowParams(
  startRaw: string | null,
  endRaw: string | null,
  maxDurationMs: number,
): { startMs: number | null; endMs: number | null } {
  const startMs = parseInteger(startRaw)
  const endMs = parseInteger(endRaw)

  if (startMs === null || endMs === null) {
    return { startMs: null, endMs: null }
  }

  if (startMs < 0 || endMs <= 0 || startMs >= endMs || endMs > maxDurationMs) {
    return { startMs: null, endMs: null }
  }

  return { startMs, endMs }
}

/** Normalize a fight query state against current valid players and targets. */
export function resolveFightQueryState({
  searchParams,
  validPlayerIds,
  validActorIds,
  validTargetKeys,
  maxDurationMs,
}: {
  searchParams: URLSearchParams
  validPlayerIds: Set<number>
  validActorIds: Set<number>
  validTargetKeys: Set<string>
  maxDurationMs: number
}): FightQueryState {
  const players = normalizePlayerIds(
    parsePlayersParam(searchParams.get('players')).filter((id) =>
      validPlayerIds.has(id),
    ),
  )
  const pinnedPlayers = normalizePlayerIds(
    parsePlayersParam(searchParams.get('pinnedPlayers')).filter((id) =>
      validPlayerIds.has(id),
    ),
  )
  const parsedFocusId = parseInteger(searchParams.get('focusId'))
  const focusId =
    parsedFocusId !== null && validActorIds.has(parsedFocusId)
      ? parsedFocusId
      : null
  const parsedTargetSelection = parseTargetSelectionParams(
    searchParams.get('targetId'),
    searchParams.get('targetInstance'),
    validTargetKeys,
  )
  const { startMs, endMs } = parseWindowParams(
    searchParams.get('startMs'),
    searchParams.get('endMs'),
    maxDurationMs,
  )

  return {
    players,
    pinnedPlayers,
    focusId,
    targetId: parsedTargetSelection?.targetId ?? null,
    targetInstance: parsedTargetSelection?.targetInstance ?? null,
    startMs,
    endMs,
  }
}

/** Write a fight query state back to URLSearchParams. */
export function applyFightQueryState(
  current: URLSearchParams,
  state: Partial<FightQueryState>,
): URLSearchParams {
  const next = new URLSearchParams(current)

  if (state.players !== undefined) {
    if (state.players.length === 0) {
      next.delete('players')
    } else {
      next.set('players', state.players.join(','))
    }
  }

  if (state.pinnedPlayers !== undefined) {
    if (state.pinnedPlayers.length === 0) {
      next.delete('pinnedPlayers')
    } else {
      next.set(
        'pinnedPlayers',
        normalizePlayerIds(state.pinnedPlayers).join(','),
      )
    }
  }

  if (state.focusId !== undefined) {
    if (state.focusId === null) {
      next.delete('focusId')
    } else {
      next.set('focusId', String(state.focusId))
    }
  }

  if (state.targetId !== undefined) {
    if (state.targetId === null) {
      next.delete('targetId')
      next.delete('targetInstance')
    } else {
      next.set('targetId', String(state.targetId))
      if (
        state.targetInstance === undefined ||
        state.targetInstance === null ||
        state.targetInstance === 0
      ) {
        next.delete('targetInstance')
      } else {
        next.set('targetInstance', String(state.targetInstance))
      }
    }
  } else if (state.targetInstance !== undefined) {
    if (state.targetInstance === null || state.targetInstance === 0) {
      next.delete('targetInstance')
    } else if (next.get('targetId')) {
      next.set('targetInstance', String(state.targetInstance))
    }
  }

  if (state.startMs !== undefined || state.endMs !== undefined) {
    if (state.startMs === null || state.endMs === null) {
      next.delete('startMs')
      next.delete('endMs')
    } else {
      next.set('startMs', String(state.startMs))
      next.set('endMs', String(state.endMs))
    }
  }

  return next
}
