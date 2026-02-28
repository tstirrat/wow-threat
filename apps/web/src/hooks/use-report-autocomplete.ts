/**
 * State + handlers for report input autocomplete suggestions.
 */
import { useState } from 'react'

import type { ReportSearchSuggestion } from '../lib/report-search'

export interface UseReportAutocompleteOptions {
  value: string
  suggestions: ReportSearchSuggestion[]
  setValue: (value: string) => void
  onSelectSuggestion?: (suggestion: ReportSearchSuggestion) => void
}

export interface UseReportAutocompleteResult {
  isAutocompleteOpen: boolean
  hasSuggestions: boolean
  shouldShowSuggestions: boolean
  selectedSuggestionValue: string
  selectedSuggestion: ReportSearchSuggestion | undefined
  openAutocomplete: () => void
  closeAutocomplete: () => void
  handleCommandValueChange: (value: string) => void
  handleInputValueChange: (value: string) => void
  selectSuggestion: (suggestion: ReportSearchSuggestion) => void
}

/** Manage report autocomplete open/selection/input state. */
export function useReportAutocomplete({
  value,
  suggestions,
  setValue,
  onSelectSuggestion,
}: UseReportAutocompleteOptions): UseReportAutocompleteResult {
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false)
  const [selectedSuggestionValue, setSelectedSuggestionValue] = useState('')

  const hasSuggestions = suggestions.length > 0
  const hasInputValue = value.trim().length > 0
  const shouldShowSuggestions =
    isAutocompleteOpen && (hasSuggestions || hasInputValue)
  const selectedSuggestion = selectedSuggestionValue
    ? suggestions.find(
        (suggestion) => suggestion.reportId === selectedSuggestionValue,
      )
    : undefined

  const openAutocomplete = (): void => {
    setIsAutocompleteOpen(true)
  }

  const closeAutocomplete = (): void => {
    setIsAutocompleteOpen(false)
  }

  const handleCommandValueChange = (nextValue: string): void => {
    setSelectedSuggestionValue(nextValue)
  }

  const handleInputValueChange = (nextValue: string): void => {
    setValue(nextValue)
    setSelectedSuggestionValue('')
    openAutocomplete()
  }

  const selectSuggestion = (suggestion: ReportSearchSuggestion): void => {
    setValue(suggestion.reportId)
    setSelectedSuggestionValue(suggestion.reportId)
    closeAutocomplete()
    onSelectSuggestion?.(suggestion)
  }

  return {
    isAutocompleteOpen,
    hasSuggestions,
    shouldShowSuggestions,
    selectedSuggestionValue,
    selectedSuggestion,
    openAutocomplete,
    closeAutocomplete,
    handleCommandValueChange,
    handleInputValueChange,
    selectSuggestion,
  }
}
