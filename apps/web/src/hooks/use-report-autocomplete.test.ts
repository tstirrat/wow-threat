/**
 * Unit tests for report input autocomplete state hook.
 */
import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { ReportSearchSuggestion } from '../lib/report-search'
import { useReportAutocomplete } from './use-report-autocomplete'

function createSuggestion(
  overrides: Partial<ReportSearchSuggestion> &
    Pick<ReportSearchSuggestion, 'reportId' | 'title'>,
): ReportSearchSuggestion {
  return {
    reportId: overrides.reportId,
    title: overrides.title,
    sourceHost: 'fresh.warcraftlogs.com',
    guildName: null,
    guildFaction: null,
    zoneName: null,
    startTime: null,
    endTime: null,
    bossKillCount: null,
    lastOpenedAt: null,
    starredAt: null,
    sourceTags: ['recent'],
    aliases: [overrides.reportId, overrides.title],
    matchedAliases: [],
    matchRanges: {},
    ...overrides,
  }
}

function useAutocompleteHarness({
  initialValue,
  suggestions,
  onSelectSuggestion,
}: {
  initialValue: string
  suggestions: ReportSearchSuggestion[]
  onSelectSuggestion?: (suggestion: ReportSearchSuggestion) => void
}) {
  const [value, setValue] = useState(initialValue)
  const autocomplete = useReportAutocomplete({
    value,
    suggestions,
    setValue,
    onSelectSuggestion,
  })

  return {
    value,
    ...autocomplete,
  }
}

describe('useReportAutocomplete', () => {
  it('starts closed and only shows suggestions after opening', () => {
    const suggestions = [
      createSuggestion({ reportId: 'ABC123', title: 'Naxx' }),
    ]
    const { result } = renderHook(() =>
      useAutocompleteHarness({
        initialValue: '',
        suggestions,
      }),
    )

    expect(result.current.hasSuggestions).toBe(true)
    expect(result.current.isAutocompleteOpen).toBe(false)
    expect(result.current.shouldShowSuggestions).toBe(false)

    act(() => {
      result.current.openAutocomplete()
    })

    expect(result.current.isAutocompleteOpen).toBe(true)
    expect(result.current.shouldShowSuggestions).toBe(true)
  })

  it('updates value, clears current selection, and opens on input change', () => {
    const suggestions = [
      createSuggestion({ reportId: 'ABC123', title: 'Naxx' }),
      createSuggestion({ reportId: 'DEF456', title: 'AQ40' }),
    ]
    const { result } = renderHook(() =>
      useAutocompleteHarness({
        initialValue: '',
        suggestions,
      }),
    )

    act(() => {
      result.current.handleCommandValueChange('DEF456')
    })

    expect(result.current.selectedSuggestion?.reportId).toBe('DEF456')

    act(() => {
      result.current.handleInputValueChange('naxx')
    })

    expect(result.current.value).toBe('naxx')
    expect(result.current.selectedSuggestionValue).toBe('')
    expect(result.current.selectedSuggestion).toBeUndefined()
    expect(result.current.isAutocompleteOpen).toBe(true)
    expect(result.current.shouldShowSuggestions).toBe(true)
  })

  it('selects suggestion, updates value, closes menu, and triggers callback', () => {
    const selectedSuggestion = createSuggestion({
      reportId: 'DEF456',
      title: 'AQ40',
    })
    const suggestions = [
      createSuggestion({ reportId: 'ABC123', title: 'Naxx' }),
      selectedSuggestion,
    ]
    const onSelectSuggestion = vi.fn()
    const { result } = renderHook(() =>
      useAutocompleteHarness({
        initialValue: '',
        suggestions,
        onSelectSuggestion,
      }),
    )

    act(() => {
      result.current.openAutocomplete()
    })

    act(() => {
      result.current.selectSuggestion(selectedSuggestion)
    })

    expect(onSelectSuggestion).toHaveBeenCalledTimes(1)
    expect(onSelectSuggestion).toHaveBeenCalledWith(selectedSuggestion)
    expect(result.current.value).toBe('DEF456')
    expect(result.current.selectedSuggestionValue).toBe('DEF456')
    expect(result.current.isAutocompleteOpen).toBe(false)
    expect(result.current.shouldShowSuggestions).toBe(false)
  })

  it('shows popover with input text even when there are no suggestions', () => {
    const { result } = renderHook(() =>
      useAutocompleteHarness({
        initialValue: '',
        suggestions: [],
      }),
    )

    act(() => {
      result.current.openAutocomplete()
    })

    expect(result.current.hasSuggestions).toBe(false)
    expect(result.current.shouldShowSuggestions).toBe(false)

    act(() => {
      result.current.handleInputValueChange('not-found')
    })

    expect(result.current.value).toBe('not-found')
    expect(result.current.shouldShowSuggestions).toBe(true)
  })
})
