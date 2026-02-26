/**
 * Unit tests for platform-aware keyboard shortcut labels.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { superKey } from './keyboard-shortcut'

const originalPlatform = navigator.platform

describe('superKey', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: originalPlatform,
    })
  })

  it('returns command on mac platforms', () => {
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    })

    expect(superKey()).toBe('⌘')
  })

  it('returns control on non-mac platforms', () => {
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'Linux x86_64',
    })

    expect(superKey()).toBe('Ctrl')
  })
})
