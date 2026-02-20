/**
 * Tests for encryption and random token helpers.
 */
import { describe, expect, it } from 'vitest'

import {
  createRandomBase64Url,
  decryptSecret,
  encryptSecret,
  importAesGcmKey,
} from './token-utils'

describe('createRandomBase64Url', () => {
  it('produces a non-empty string', () => {
    const token = createRandomBase64Url()
    expect(token.length).toBeGreaterThan(0)
  })

  it('produces unique values across calls', () => {
    const tokens = Array.from({ length: 10 }, () => createRandomBase64Url())
    const unique = new Set(tokens)
    expect(unique.size).toBe(10)
  })

  it('produces longer output for larger size parameter', () => {
    const small = createRandomBase64Url(8)
    const large = createRandomBase64Url(64)
    expect(large.length).toBeGreaterThan(small.length)
  })

  it('produces only base64url characters', () => {
    const token = createRandomBase64Url(32)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('encrypt / decrypt roundtrip', () => {
  it('recovers the original plaintext', async () => {
    const key = await importAesGcmKey('test-secret')
    const plaintext = 'my-sensitive-token-value'

    const encrypted = await encryptSecret(plaintext, key)
    const decrypted = await decryptSecret(encrypted, key)

    expect(decrypted).toBe(plaintext)
  })

  it('handles empty string', async () => {
    const key = await importAesGcmKey('test-secret')

    const encrypted = await encryptSecret('', key)
    const decrypted = await decryptSecret(encrypted, key)

    expect(decrypted).toBe('')
  })

  it('handles long values', async () => {
    const key = await importAesGcmKey('test-secret')
    const longValue = 'x'.repeat(10_000)

    const encrypted = await encryptSecret(longValue, key)
    const decrypted = await decryptSecret(encrypted, key)

    expect(decrypted).toBe(longValue)
  })

  it('handles unicode content', async () => {
    const key = await importAesGcmKey('test-secret')
    const unicodeValue = '🔒 secure token — résumé'

    const encrypted = await encryptSecret(unicodeValue, key)
    const decrypted = await decryptSecret(encrypted, key)

    expect(decrypted).toBe(unicodeValue)
  })

  it('produces different ciphertext for the same plaintext (random IV)', async () => {
    const key = await importAesGcmKey('test-secret')
    const plaintext = 'same-value'

    const a = await encryptSecret(plaintext, key)
    const b = await encryptSecret(plaintext, key)

    expect(a).not.toBe(b)
  })

  it('produces versioned envelope with v1 prefix', async () => {
    const key = await importAesGcmKey('test-secret')
    const encrypted = await encryptSecret('value', key)

    expect(encrypted).toMatch(/^v1\./)
    const parts = encrypted.split('.')
    expect(parts).toHaveLength(3)
  })
})

describe('decryptSecret error handling', () => {
  it('rejects payloads with wrong version prefix', async () => {
    const key = await importAesGcmKey('test-secret')

    await expect(decryptSecret('v2.abc.def', key)).rejects.toThrow(
      'Invalid encrypted secret payload',
    )
  })

  it('rejects payloads with missing parts', async () => {
    const key = await importAesGcmKey('test-secret')

    await expect(decryptSecret('v1.only-one-part', key)).rejects.toThrow(
      'Invalid encrypted secret payload',
    )
  })

  it('rejects payloads with no dots', async () => {
    const key = await importAesGcmKey('test-secret')

    await expect(decryptSecret('not-encrypted', key)).rejects.toThrow(
      'Invalid encrypted secret payload',
    )
  })

  it('rejects ciphertext encrypted with a different key', async () => {
    const keyA = await importAesGcmKey('secret-a')
    const keyB = await importAesGcmKey('secret-b')
    const encrypted = await encryptSecret('sensitive', keyA)

    await expect(decryptSecret(encrypted, keyB)).rejects.toThrow()
  })
})
