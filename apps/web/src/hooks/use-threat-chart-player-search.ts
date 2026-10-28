/**
 * Player slash-search state and selection behavior for the threat chart.
 */
import type { PostHog } from 'posthog-js'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useMemo,
  useState,
} from 'react'

import {
  type PlayerSearchOption,
  buildPlayerSearchOptions,
  filterPlayerSearchOptions,
} from '../lib/player-search'
import type { ThreatSeries } from '../types/app'

function resolveFocusedPlayerId({
  focusedActorId,
  series,
}: {
  focusedActorId: number | null
  series: ThreatSeries[]
}): number | null {
  if (focusedActorId === null) {
    return null
  }

  const focusedActor = series.find((item) => item.actorId === focusedActorId)
  if (!focusedActor) {
    return null
  }

  if (focusedActor.actorType === 'Player') {
    return focusedActor.actorId
  }

  return focusedActor.ownerId
}

export interface UseThreatChartPlayerSearchResult {
  isPlayerSearchOpen: boolean
  playerSearchQuery: string
  filteredPlayerSearchOptions: PlayerSearchOption[]
  resolvedHighlightedPlayerId: number | null
  openPlayerSearch: () => void
  closePlayerSearch: () => void
  setPlayerSearchQuery: (query: string) => void
  setHighlightedPlayerId: (playerId: number | null) => void
  handlePlayerSearchInputKeyDown: (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => void
  selectPlayer: ({
    playerId,
    shouldAddToFilter,
    selectionMethod,
  }: {
    playerId: number
    shouldAddToFilter: boolean
    selectionMethod: 'click' | 'keyboard'
  }) => void
  focusedPlayerId: number | null
  isolateFocusedPlayer: () => void
}

/** Manage player-search filtering, highlighting, and focus/isolate selection behavior. */
export function useThreatChartPlayerSearch({
  series,
  focusedActorId,
  onFocusAndAddPlayer,
  onFocusAndIsolatePlayer,
  onToggleFocusedPlayerIsolation,
  clearIsolate,
  fightId,
  reportId,
  posthog,
}: {
  series: ThreatSeries[]
  focusedActorId: number | null
  onFocusAndAddPlayer: (playerId: number) => void
  onFocusAndIsolatePlayer: (playerId: number) => void
  onToggleFocusedPlayerIsolation: (playerId: number) => void
  clearIsolate: () => void
  fightId?: number
  reportId?: string
  posthog?: PostHog
}): UseThreatChartPlayerSearchResult {
  const [isPlayerSearchOpen, setIsPlayerSearchOpen] = useState(false)
  const [playerSearchQuery, setPlayerSearchQuery] = useState('')
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<number | null>(
    null,
  )

  const focusedPlayerId = useMemo(
    () =>
      resolveFocusedPlayerId({
        focusedActorId,
        series,
      }),
    [focusedActorId, series],
  )

  const playerSearchOptions = useMemo(
    () => buildPlayerSearchOptions(series),
    [series],
  )
  const filteredPlayerSearchOptions = useMemo(
    () => filterPlayerSearchOptions(playerSearchOptions, playerSearchQuery),
    [playerSearchOptions, playerSearchQuery],
  )
  const resolvedHighlightedPlayerId = useMemo(() => {
    const hasHighlightedPlayer = filteredPlayerSearchOptions.some(
      (option) => option.actorId === highlightedPlayerId,
    )
    if (hasHighlightedPlayer) {
      return highlightedPlayerId
    }

    return filteredPlayerSearchOptions[0]?.actorId ?? null
  }, [filteredPlayerSearchOptions, highlightedPlayerId])

  const closePlayerSearch = useCallback((): void => {
    setIsPlayerSearchOpen(false)
    setPlayerSearchQuery('')
    setHighlightedPlayerId(null)
  }, [])

  const openPlayerSearch = useCallback((): void => {
    posthog?.capture('player_fuzzy_search_opened', {
      fight_id: fightId,
      report_id: reportId,
    })
    setIsPlayerSearchOpen(true)
    setPlayerSearchQuery('')
    setHighlightedPlayerId(null)
  }, [fightId, posthog, reportId])

  const selectPlayer = useCallback(
    ({
      playerId,
      shouldAddToFilter,
      selectionMethod,
    }: {
      playerId: number
      shouldAddToFilter: boolean
      selectionMethod: 'click' | 'keyboard'
    }): void => {
      posthog?.capture('player_fuzzy_search_selected', {
        fight_id: fightId,
        report_id: reportId,
        player_id: playerId,
        selection_method: selectionMethod,
      })
      if (shouldAddToFilter) {
        onFocusAndAddPlayer(playerId)
      } else {
        onFocusAndIsolatePlayer(playerId)
      }
      clearIsolate()
      closePlayerSearch()
    },
    [
      clearIsolate,
      closePlayerSearch,
      fightId,
      onFocusAndAddPlayer,
      onFocusAndIsolatePlayer,
      posthog,
      reportId,
    ],
  )

  const selectHighlightedPlayer = useCallback(
    (shouldAddToFilter: boolean): void => {
      const selectedPlayer =
        filteredPlayerSearchOptions.find(
          (option) => option.actorId === resolvedHighlightedPlayerId,
        ) ?? filteredPlayerSearchOptions[0]
      if (!selectedPlayer) {
        return
      }

      selectPlayer({
        playerId: selectedPlayer.actorId,
        shouldAddToFilter,
        selectionMethod: 'keyboard',
      })
    },
    [filteredPlayerSearchOptions, resolvedHighlightedPlayerId, selectPlayer],
  )

  const handlePlayerSearchInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closePlayerSearch()
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        selectHighlightedPlayer(event.shiftKey)
        return
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return
      }

      event.preventDefault()
      if (filteredPlayerSearchOptions.length === 0) {
        return
      }

      const currentIndex = filteredPlayerSearchOptions.findIndex(
        (option) => option.actorId === resolvedHighlightedPlayerId,
      )
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex =
        currentIndex === -1
          ? direction === 1
            ? 0
            : filteredPlayerSearchOptions.length - 1
          : (currentIndex + direction + filteredPlayerSearchOptions.length) %
            filteredPlayerSearchOptions.length

      setHighlightedPlayerId(
        filteredPlayerSearchOptions[nextIndex]?.actorId ?? null,
      )
    },
    [
      closePlayerSearch,
      filteredPlayerSearchOptions,
      resolvedHighlightedPlayerId,
      selectHighlightedPlayer,
    ],
  )

  const isolateFocusedPlayer = useCallback((): void => {
    if (focusedPlayerId === null) {
      return
    }

    clearIsolate()
    onToggleFocusedPlayerIsolation(focusedPlayerId)
  }, [clearIsolate, focusedPlayerId, onToggleFocusedPlayerIsolation])

  return {
    isPlayerSearchOpen,
    playerSearchQuery,
    filteredPlayerSearchOptions,
    resolvedHighlightedPlayerId,
    openPlayerSearch,
    closePlayerSearch,
    setPlayerSearchQuery,
    setHighlightedPlayerId,
    handlePlayerSearchInputKeyDown,
    selectPlayer,
    focusedPlayerId,
    isolateFocusedPlayer,
  }
}
