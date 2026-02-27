/**
 * Unit tests for threat-chart fixate bands local-storage preference helpers.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { threatChartShowFixateBandsStorageKey } from './constants'
import {
  loadShowFixateBandsPreference,
  saveShowFixateBandsPreference,
} from './threat-chart-fixate-bands-preference'

describe('threat-chart-fixate-bands-preference', () => {
  let originalLocalStorage: Storage

  beforeEach(() => {
    originalLocalStorage = window.localStorage
    const values = new Map<string, string>()
    const mockLocalStorage = {
      clear: (): void => {
        values.clear()
      },
      getItem: (key: string): string | null => values.get(key) ?? null,
      key: (index: number): string | null =>
        Array.from(values.keys())[index] ?? null,
      get length(): number {
        return values.size
      },
      removeItem: (key: string): void => {
        values.delete(key)
      },
      setItem: (key: string, value: string): void => {
        values.set(key, value)
      },
    } satisfies Storage

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: mockLocalStorage,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    })
  })

  it('defaults to showing fixate bands when no preference is stored', () => {
    expect(loadShowFixateBandsPreference()).toBe(true)
  })

  it('loads false from local storage when persisted', () => {
    window.localStorage.setItem(threatChartShowFixateBandsStorageKey, 'false')

    expect(loadShowFixateBandsPreference()).toBe(false)
  })

  it('falls back to true for invalid stored values', () => {
    window.localStorage.setItem(
      threatChartShowFixateBandsStorageKey,
      'unexpected',
    )

    expect(loadShowFixateBandsPreference()).toBe(true)
  })

  it('persists checkbox changes to local storage', () => {
    saveShowFixateBandsPreference(false)
    expect(
      window.localStorage.getItem(threatChartShowFixateBandsStorageKey),
    ).toBe('false')

    saveShowFixateBandsPreference(true)
    expect(
      window.localStorage.getItem(threatChartShowFixateBandsStorageKey),
    ).toBe('true')
  })
})
