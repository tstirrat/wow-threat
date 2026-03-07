/**
 * Unit tests for shared URL query-param parsing helpers.
 */
import { describe, expect, it } from 'vitest'

import { parseBooleanQueryParam } from './query-params'

describe('query-params', () => {
  it('parses 1 and true values as true', () => {
    expect(parseBooleanQueryParam('1')).toBe(true)
    expect(parseBooleanQueryParam('true')).toBe(true)
    expect(parseBooleanQueryParam(' TrUe ')).toBe(true)
  })

  it('parses false values as false', () => {
    expect(parseBooleanQueryParam('false')).toBe(false)
    expect(parseBooleanQueryParam(' FALSE ')).toBe(false)
    expect(parseBooleanQueryParam('0')).toBe(false)
  })

  it('returns null for missing or unsupported values', () => {
    expect(parseBooleanQueryParam(null)).toBeNull()
    expect(parseBooleanQueryParam('')).toBeNull()
    expect(parseBooleanQueryParam('yes')).toBeNull()
  })
})
