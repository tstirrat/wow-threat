/**
 * Target search overlay used by fight-page keyboard shortcuts.
 */
import type { KeyboardEventHandler } from 'react'

import type { TargetSearchOption } from '../lib/target-search'
import { Input } from './ui/input'
import { Kbd } from './ui/kbd'

export interface FightTargetSearchProps {
  isOpen: boolean
  query: string
  options: TargetSearchOption[]
  highlightedTargetKey: string | null
  onClose: () => void
  onQueryChange: (query: string) => void
  onInputKeyDown: KeyboardEventHandler<HTMLInputElement>
  onHighlightTarget: (targetKey: string) => void
  onSelectTarget: (targetKey: string) => void
}

/** Render keyboard target search overlay and option list interactions. */
export function FightTargetSearch({
  isOpen,
  query,
  options,
  highlightedTargetKey,
  onClose,
  onQueryChange,
  onInputKeyDown,
  onHighlightTarget,
  onSelectTarget,
}: FightTargetSearchProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      aria-label="Target search"
      aria-modal="false"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      onClick={() => {
        onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-card p-3 shadow-lg"
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Target search</h2>
          <Kbd>T</Kbd>
        </div>
        <Input
          autoFocus
          aria-label="Search targets"
          placeholder="Search targets..."
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value)
          }}
          onKeyDown={onInputKeyDown}
        />
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {options.length === 0 ? (
            <li className="rounded-sm px-2 py-1 text-xs text-muted-foreground">
              No targets match your search.
            </li>
          ) : (
            options.map((option) => {
              const isHighlighted = highlightedTargetKey === option.key
              return (
                <li key={option.key}>
                  <button
                    className={`flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-sm ${
                      isHighlighted
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/60'
                    }`}
                    type="button"
                    onMouseEnter={() => {
                      onHighlightTarget(option.key)
                    }}
                    onClick={() => {
                      onSelectTarget(option.key)
                    }}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span className="truncate">{option.label}</span>
                      {option.isBoss ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          Boss
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      #{option.id}:{option.instance}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Enter selects target and updates URL.
        </p>
      </div>
    </div>
  )
}
