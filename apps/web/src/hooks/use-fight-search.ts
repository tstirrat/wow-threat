/**
 * State and keyboard interactions for report/fight fuzzy fight search dialog.
 */
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useMemo,
  useState,
} from 'react'

import {
  buildFightSearchOptions,
  filterFightSearchOptions,
} from '../lib/fight-search'
import type { ReportFightSummary } from '../types/api'

export interface UseFightSearchResult {
  isOpen: boolean
  query: string
  options: ReturnType<typeof filterFightSearchOptions>
  highlightedFightId: number | null
  open: () => void
  close: () => void
  setQuery: (query: string) => void
  setHighlightedFightId: (fightId: number | null) => void
  handleInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void
  selectFight: (fightId: number) => void
}

/** Manage fuzzy fight search filtering and keyboard selection state. */
export function useFightSearch({
  fights,
  onSelectFight,
}: {
  fights: ReportFightSummary[]
  onSelectFight: (fightId: number) => void
}): UseFightSearchResult {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedFightId, setHighlightedFightId] = useState<number | null>(
    null,
  )

  const fightOptions = useMemo(() => buildFightSearchOptions(fights), [fights])
  const options = useMemo(
    () => filterFightSearchOptions(fightOptions, query),
    [fightOptions, query],
  )
  const resolvedHighlightedFightId = useMemo(() => {
    const isHighlightedFightVisible = options.some(
      (option) => option.id === highlightedFightId,
    )
    if (isHighlightedFightVisible) {
      return highlightedFightId
    }

    return options[0]?.id ?? null
  }, [options, highlightedFightId])

  const close = useCallback((): void => {
    setIsOpen(false)
    setQuery('')
    setHighlightedFightId(null)
  }, [])

  const open = useCallback((): void => {
    setIsOpen(true)
    setQuery('')
    setHighlightedFightId(null)
  }, [])

  const selectFight = useCallback(
    (fightId: number): void => {
      onSelectFight(fightId)
      close()
    },
    [close, onSelectFight],
  )

  const handleInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const selectedFight =
          options.find((option) => option.id === resolvedHighlightedFightId) ??
          options[0]
        if (!selectedFight) {
          return
        }

        selectFight(selectedFight.id)
        return
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return
      }

      event.preventDefault()
      if (options.length === 0) {
        return
      }

      const currentIndex = options.findIndex(
        (option) => option.id === resolvedHighlightedFightId,
      )
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex =
        currentIndex === -1
          ? direction === 1
            ? 0
            : options.length - 1
          : (currentIndex + direction + options.length) % options.length

      setHighlightedFightId(options[nextIndex]?.id ?? null)
    },
    [close, options, resolvedHighlightedFightId, selectFight],
  )

  return {
    isOpen,
    query,
    options,
    highlightedFightId: resolvedHighlightedFightId,
    open,
    close,
    setQuery,
    setHighlightedFightId,
    handleInputKeyDown,
    selectFight,
  }
}
