/**
 * Input form for loading a report from URL/code with autocomplete suggestions.
 */
import { Search } from 'lucide-react'
import { type FC, type ReactNode, type Ref, useState } from 'react'

import { useReportAutocomplete } from '../hooks/use-report-autocomplete'
import type {
  ReportSearchMatchRange,
  ReportSearchSuggestion,
} from '../lib/report-search'
import { cn } from '../lib/utils'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command'
import { Popover, PopoverAnchor, PopoverContent } from './ui/popover'

function formatSourceTag(sourceTag: string): string {
  if (sourceTag === 'personal') {
    return 'personal'
  }
  if (sourceTag === 'starred') {
    return 'starred'
  }
  if (sourceTag === 'recent') {
    return 'recent'
  }
  if (sourceTag === 'guild') {
    return 'guild'
  }

  return 'example'
}

type ReportGuildFaction = 'alliance' | 'horde' | null

function normalizeGuildFaction(
  value: string | null | undefined,
): ReportGuildFaction {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'alliance') {
    return 'alliance'
  }
  if (normalized === 'horde') {
    return 'horde'
  }

  return null
}

function resolveFactionTextClass(faction: ReportGuildFaction): string {
  if (faction === 'alliance') {
    return 'text-sky-500 dark:text-sky-400'
  }
  if (faction === 'horde') {
    return 'text-red-500 dark:text-red-400'
  }

  return 'text-foreground'
}

function resolveFactionBorderClass(faction: ReportGuildFaction): string {
  if (faction === 'alliance') {
    return 'border-l-sky-500/70'
  }
  if (faction === 'horde') {
    return 'border-l-red-500/70'
  }

  return 'border-l-border'
}

function mergeRanges(
  ranges: ReportSearchMatchRange[],
): ReportSearchMatchRange[] {
  if (ranges.length <= 1) {
    return ranges
  }

  const sortedRanges = [...ranges].sort((left, right) => left[0] - right[0])
  const mergedRanges: ReportSearchMatchRange[] = [sortedRanges[0]]

  sortedRanges.slice(1).forEach((range) => {
    const previousRange = mergedRanges[mergedRanges.length - 1]
    if (!previousRange) {
      mergedRanges.push(range)
      return
    }

    if (range[0] <= previousRange[1] + 1) {
      previousRange[1] = Math.max(previousRange[1], range[1])
      return
    }

    mergedRanges.push(range)
  })

  return mergedRanges
}

function renderHighlightedText(
  text: string,
  ranges: ReportSearchMatchRange[] | undefined,
): ReactNode {
  if (!ranges || ranges.length === 0) {
    return text
  }

  const safeRanges = mergeRanges(
    ranges.filter(([start, end]) => start >= 0 && end >= start),
  )
  if (safeRanges.length === 0) {
    return text
  }

  const parts: ReactNode[] = []
  let cursor = 0
  safeRanges.forEach(([start, end], index) => {
    if (start > cursor) {
      parts.push(
        <span key={`plain-${index}-${cursor}`}>
          {text.slice(cursor, start)}
        </span>,
      )
    }

    parts.push(
      <mark
        className="rounded-sm bg-primary/20 px-0.5 font-semibold text-foreground"
        key={`mark-${index}-${start}`}
      >
        {text.slice(start, end + 1)}
      </mark>,
    )
    cursor = end + 1
  })

  if (cursor < text.length) {
    parts.push(<span key={`plain-tail-${cursor}`}>{text.slice(cursor)}</span>)
  }

  return <>{parts}</>
}

export type ReportUrlFormProps = {
  onSubmit: (input: string) => void
  onSelectSuggestion?: (suggestion: ReportSearchSuggestion) => void
  onInputEscape?: () => void
  onInputBlur?: () => void
  isSubmitting?: boolean
  inputAriaLabel?: string
  placeholder?: string
  submitLabel?: string
  submitIconOnly?: boolean
  inputRef?: Ref<HTMLInputElement>
  suggestions?: ReportSearchSuggestion[]
  value?: string
  onValueChange?: (value: string) => void
  className?: string
}

export const ReportUrlForm: FC<ReportUrlFormProps> = ({
  onSubmit,
  onSelectSuggestion,
  onInputEscape,
  onInputBlur,
  isSubmitting = false,
  inputAriaLabel = 'Report URL or ID',
  placeholder = 'Paste Warcraft Logs report URL or report ID',
  submitLabel = 'Load report',
  submitIconOnly = false,
  inputRef,
  suggestions = [],
  value: controlledValue,
  onValueChange,
  className,
}) => {
  const [internalValue, setInternalValue] = useState('')
  const value = controlledValue ?? internalValue
  const trimmedValue = value.trim()
  const isFullyQualifiedUrlInput = /^https?:\/\//i.test(trimmedValue)
  const setValue = onValueChange ?? setInternalValue
  const {
    hasSuggestions,
    shouldShowSuggestions,
    selectedSuggestionValue,
    selectedSuggestion,
    closeAutocomplete,
    openAutocomplete,
    handleCommandValueChange,
    handleInputValueChange,
    selectSuggestion,
  } = useReportAutocomplete({
    value,
    suggestions,
    setValue,
    onSelectSuggestion,
  })
  const handleFormSubmit = (): void => {
    if (
      !isFullyQualifiedUrlInput &&
      selectedSuggestion &&
      shouldShowSuggestions
    ) {
      selectSuggestion(selectedSuggestion)
      return
    }

    onSubmit(value)
  }

  return (
    <form
      aria-label="Load Warcraft Logs report"
      className={className ?? 'flex flex-col gap-3 sm:flex-row sm:items-end'}
      onBlur={(event) => {
        const nextFocusedElement = event.relatedTarget
        if (
          nextFocusedElement &&
          event.currentTarget.contains(nextFocusedElement)
        ) {
          return
        }

        closeAutocomplete()
        onInputBlur?.()
      }}
      onSubmit={(event) => {
        event.preventDefault()
        handleFormSubmit()
      }}
    >
      <div className="w-full">
        <Command
          className="w-full overflow-visible bg-transparent shadow-none"
          loop
          shouldFilter={false}
          value={selectedSuggestionValue}
          onValueChange={handleCommandValueChange}
        >
          <Popover open={shouldShowSuggestions}>
            <PopoverAnchor asChild>
              <CommandInput
                aria-controls={
                  shouldShowSuggestions ? 'report-input-suggestions' : undefined
                }
                aria-expanded={shouldShowSuggestions}
                aria-haspopup="listbox"
                aria-label={inputAriaLabel}
                disabled={isSubmitting}
                name="report-input"
                placeholder={placeholder}
                ref={inputRef}
                value={value}
                onFocus={() => {
                  openAutocomplete()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    closeAutocomplete()
                    event.currentTarget.blur()
                    onInputEscape?.()
                    return
                  }

                  if (event.key !== 'Enter') {
                    return
                  }

                  if (isFullyQualifiedUrlInput) {
                    event.preventDefault()
                    event.stopPropagation()
                    onSubmit(value)
                    return
                  }

                  if (selectedSuggestion) {
                    event.preventDefault()
                    event.stopPropagation()
                    selectSuggestion(selectedSuggestion)
                  }
                }}
                onValueChange={handleInputValueChange}
              />
            </PopoverAnchor>
            <PopoverContent
              align="start"
              className="w-[var(--radix-popover-trigger-width)] p-0"
              onOpenAutoFocus={(event) => {
                event.preventDefault()
              }}
            >
              <CommandList
                aria-label="Report suggestions"
                id="report-input-suggestions"
                role="listbox"
              >
                {hasSuggestions ? (
                  <CommandGroup>
                    {suggestions.map((suggestion) => {
                      const sourceTags = suggestion.sourceTags
                        .slice(0, 3)
                        .map((sourceTag) => formatSourceTag(sourceTag))
                      const zoneLabel = suggestion.zoneName ?? 'Unknown zone'
                      const guildLabel = suggestion.guildName
                        ? `<${suggestion.guildName}>`
                        : null
                      const faction = normalizeGuildFaction(
                        suggestion.guildFaction,
                      )
                      const factionTextClass = resolveFactionTextClass(faction)
                      const factionBorderClass =
                        resolveFactionBorderClass(faction)
                      const sourceLabel =
                        suggestion.sourceHost.split('.')[0]?.toLowerCase() ??
                        'unknown'
                      const matchedAliases = [
                        ...new Set(
                          suggestion.matchedAliases
                            .map((alias) => alias.trim())
                            .filter(
                              (alias) =>
                                alias.length > 0 &&
                                alias.toLowerCase() !==
                                  suggestion.reportId.toLowerCase(),
                            ),
                        ),
                      ].slice(0, 2)

                      return (
                        <CommandItem
                          className={cn(
                            'items-start gap-3 border-l-2 py-2 data-[selected=true]:bg-muted/70 data-[selected=true]:text-foreground',
                            factionBorderClass,
                          )}
                          key={suggestion.reportId}
                          keywords={suggestion.aliases}
                          role="option"
                          value={suggestion.reportId}
                          onMouseDown={(event) => {
                            event.preventDefault()
                          }}
                          onSelect={() => {
                            selectSuggestion(suggestion)
                          }}
                        >
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span
                              className={cn(
                                'truncate text-sm font-semibold',
                                factionTextClass,
                              )}
                            >
                              {renderHighlightedText(
                                suggestion.title || suggestion.reportId,
                                suggestion.matchRanges.title ??
                                  suggestion.matchRanges.reportId,
                              )}
                            </span>
                            {suggestion.title.toLowerCase() !==
                            suggestion.reportId.toLowerCase() ? (
                              <span className="truncate text-[11px] text-muted-foreground">
                                {renderHighlightedText(
                                  suggestion.reportId,
                                  suggestion.matchRanges.reportId,
                                )}
                              </span>
                            ) : null}
                            <span className="truncate text-xs text-muted-foreground">
                              {renderHighlightedText(
                                zoneLabel,
                                suggestion.matchRanges.zoneName,
                              )}
                              {guildLabel ? (
                                <>
                                  <span> - </span>
                                  <span className={factionTextClass}>
                                    {renderHighlightedText(
                                      guildLabel,
                                      suggestion.matchRanges.guildName,
                                    )}
                                  </span>
                                </>
                              ) : null}
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge variant="outline">{sourceLabel}</Badge>
                              {sourceTags.map((sourceTag) => (
                                <Badge
                                  className="capitalize"
                                  key={`${suggestion.reportId}-${sourceTag}`}
                                  variant="secondary"
                                >
                                  {sourceTag}
                                </Badge>
                              ))}
                              {matchedAliases.map((alias) => (
                                <Badge
                                  className="max-w-44 truncate"
                                  key={`${suggestion.reportId}-alias-${alias}`}
                                  variant="outline"
                                >
                                  match: {alias}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                ) : (
                  <CommandEmpty>No reports match your search.</CommandEmpty>
                )}
              </CommandList>
            </PopoverContent>
          </Popover>
        </Command>
      </div>
      <Button
        aria-label={submitLabel}
        className="sm:self-end"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? (
          'Loading...'
        ) : submitIconOnly ? (
          <Search aria-hidden="true" className="size-4" />
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  )
}
