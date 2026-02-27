/**
 * Player search overlay used by threat chart keyboard shortcuts.
 */
import { Shield } from 'lucide-react'
import type { KeyboardEventHandler } from 'react'

import type { PlayerSearchOption } from '../lib/player-search'
import { Input } from './ui/input'
import { Kbd } from './ui/kbd'

export interface ThreatChartPlayerSearchProps {
  isOpen: boolean
  query: string
  options: PlayerSearchOption[]
  highlightedPlayerId: number | null
  onClose: () => void
  onQueryChange: (query: string) => void
  onInputKeyDown: KeyboardEventHandler<HTMLInputElement>
  onHighlightPlayer: (playerId: number) => void
  onSelectPlayer: (playerId: number) => void
}

/** Render slash-command player search overlay and option list interactions. */
export function ThreatChartPlayerSearch({
  isOpen,
  query,
  options,
  highlightedPlayerId,
  onClose,
  onQueryChange,
  onInputKeyDown,
  onHighlightPlayer,
  onSelectPlayer,
}: ThreatChartPlayerSearchProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      aria-label="Player search"
      aria-modal="false"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      onClick={() => {
        onClose()
      }}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-card p-3 shadow-lg"
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Player search</h2>
          <Kbd>/</Kbd>
        </div>
        <Input
          autoFocus
          aria-label="Search players"
          placeholder="Search players..."
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value)
          }}
          onKeyDown={onInputKeyDown}
        />
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {options.length === 0 ? (
            <li className="rounded-sm px-2 py-1 text-xs text-muted-foreground">
              No players match your search.
            </li>
          ) : (
            options.map((option) => {
              const isHighlighted = highlightedPlayerId === option.actorId
              return (
                <li key={option.actorId}>
                  <button
                    className={`flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-sm ${
                      isHighlighted
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/60'
                    }`}
                    type="button"
                    onMouseEnter={() => {
                      onHighlightPlayer(option.actorId)
                    }}
                    onClick={() => {
                      onSelectPlayer(option.actorId)
                    }}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: option.color }}
                      />
                      <span className="truncate">{option.label}</span>
                      {option.isTank ? (
                        <Shield
                          aria-hidden="true"
                          className="h-3 w-3 flex-shrink-0 text-amber-500"
                        />
                      ) : null}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Enter isolates. Shift+Enter adds to the current filter and focuses.
        </p>
      </div>
    </div>
  )
}
