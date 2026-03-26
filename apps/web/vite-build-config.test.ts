/**
 * Unit tests for the vite build configuration factory helpers.
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'

import { getEsbuildOptions } from './vite.config'

describe('getEsbuildOptions', () => {
  it('returns undefined in development mode', () => {
    expect(getEsbuildOptions('development')).toBeUndefined()
  })

  it('returns undefined for unknown modes', () => {
    expect(getEsbuildOptions('test')).toBeUndefined()
    expect(getEsbuildOptions('')).toBeUndefined()
  })

  it('returns pure list in production mode', () => {
    const options = getEsbuildOptions('production')
    expect(options).toBeDefined()
    expect(options?.pure).toEqual(
      expect.arrayContaining(['console.log', 'console.info', 'console.debug']),
    )
  })

  it('does not include console.warn in production pure list', () => {
    const options = getEsbuildOptions('production')
    expect(options?.pure).not.toContain('console.warn')
  })

  it('does not include console.error in production pure list', () => {
    const options = getEsbuildOptions('production')
    expect(options?.pure).not.toContain('console.error')
  })
})
