/**
 * Fuzzy fight selector dialog for report and fight routes.
 */
import type { KeyboardEventHandler } from 'react'

import type { FightSearchOption } from '../lib/fight-search'
import { Input } from './ui/input'
import { Kbd } from './ui/kbd'

export interface FightSearchDialogProps {
  isOpen: boolean
  query: string
  options: FightSearchOption[]
  highlightedFightId: number | null
  onClose: () => void
  onQueryChange: (query: string) => void
  onInputKeyDown: KeyboardEventHandler<HTMLInputElement>
  onHighlightFight: (fightId: number) => void
  onSelectFight: (fightId: number) => void
}

/** Render keyboard-driven fight picker with fuzzy query matching. */
export function FightSearchDialog({
  isOpen,
  query,
  options,
  highlightedFightId,
  onClose,
  onQueryChange,
  onInputKeyDown,
  onHighlightFight,
  onSelectFight,
}: FightSearchDialogProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      aria-label="Fight search"
      aria-modal="false"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      onClick={() => {
        onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-3 shadow-lg"
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Fight search</h2>
          <Kbd>F</Kbd>
        </div>
        <Input
          autoFocus
          aria-label="Search fights"
          placeholder="Search fights..."
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value)
          }}
          onKeyDown={onInputKeyDown}
        />
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {options.length === 0 ? (
            <li className="rounded-sm px-2 py-1 text-xs text-muted-foreground">
              No fights match your search.
            </li>
          ) : (
            options.map((option) => {
              const isHighlighted = highlightedFightId === option.id
              return (
                <li key={option.id}>
                  <button
                    className={`flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-sm ${
                      isHighlighted
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/60'
                    }`}
                    type="button"
                    onMouseEnter={() => {
                      onHighlightFight(option.id)
                    }}
                    onClick={() => {
                      onSelectFight(option.id)
                    }}
                  >
                    <span className="truncate">{option.name}</span>
                    <span
                      className={
                        option.kill
                          ? 'text-xs'
                          : 'text-xs text-muted-foreground'
                      }
                    >
                      {option.kill ? 'Kill' : 'Wipe'}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}
