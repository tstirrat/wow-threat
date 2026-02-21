/**
 * Unit tests for popup auth bridge localStorage helpers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearWclAuthPopupResult,
  createWclAuthPopupErrorResult,
  createWclAuthPopupSuccessResult,
  parseWclAuthPopupResult,
  publishWclAuthPopupResult,
  readWclAuthPopupResult,
  wclAuthPopupResultStorageKey,
} from './wcl-popup-bridge'

describe('wcl-popup-bridge', () => {
  let originalLocalStorage: Storage

  beforeEach(() => {
    originalLocalStorage = window.localStorage
    const values = new Map<string, string>()
    const mockStorage = {
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
      value: mockStorage,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    })
    vi.restoreAllMocks()
  })

  it('parses a success payload', () => {
    const rawValue = JSON.stringify({
      bridgeCode: 'bridge-123',
      createdAtMs: 42,
      status: 'success',
    })

    expect(parseWclAuthPopupResult(rawValue)).toEqual({
      bridgeCode: 'bridge-123',
      createdAtMs: 42,
      status: 'success',
    })
  })

  it('parses an error payload', () => {
    const rawValue = JSON.stringify({
      createdAtMs: 42,
      message: 'Callback failed',
      status: 'error',
    })

    expect(parseWclAuthPopupResult(rawValue)).toEqual({
      createdAtMs: 42,
      message: 'Callback failed',
      status: 'error',
    })
  })

  it('returns null for invalid payloads', () => {
    expect(parseWclAuthPopupResult('not-json')).toBeNull()
    expect(
      parseWclAuthPopupResult(JSON.stringify({ status: 'success' })),
    ).toBeNull()
    expect(
      parseWclAuthPopupResult(JSON.stringify({ status: 'error' })),
    ).toBeNull()
  })

  it('creates timestamped success and error payloads', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)

    expect(createWclAuthPopupSuccessResult('bridge-abc')).toEqual({
      bridgeCode: 'bridge-abc',
      createdAtMs: 1_700_000_000_000,
      status: 'success',
    })
    expect(createWclAuthPopupErrorResult('Boom')).toEqual({
      createdAtMs: 1_700_000_000_000,
      message: 'Boom',
      status: 'error',
    })
  })

  it('publishes, reads, and clears localStorage payloads', () => {
    const payload = {
      bridgeCode: 'bridge-xyz',
      createdAtMs: 1_700_000_000_000,
      status: 'success',
    } as const

    publishWclAuthPopupResult(payload)
    expect(window.localStorage.getItem(wclAuthPopupResultStorageKey)).toEqual(
      JSON.stringify(payload),
    )
    expect(readWclAuthPopupResult()).toEqual(payload)

    clearWclAuthPopupResult()
    expect(readWclAuthPopupResult()).toBeNull()
  })
})
