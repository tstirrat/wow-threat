/**
 * Runtime configuration validation for worker bindings.
 */
import { importPKCS8 } from 'jose'

import { firestoreError } from '../middleware/error'
import type { Bindings } from '../types/bindings'

const privateKeyPlaceholderToken = '...'

let runtimeValidationPromise: Promise<void> | null = null

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n').trim()
}

function isPrivateKeyPlaceholder(value: string): boolean {
  return value.includes(privateKeyPlaceholderToken)
}

async function validateFirebasePrivateKey(pem: string): Promise<void> {
  try {
    await importPKCS8(pem, 'RS256')
  } catch {
    throw firestoreError(
      'Invalid FIREBASE_PRIVATE_KEY format. Expected a PKCS#8 private key.',
    )
  }
}

async function runRuntimeValidation(env: Bindings): Promise<void> {
  const normalizedPrivateKey = normalizePrivateKey(env.FIREBASE_PRIVATE_KEY)

  if (
    normalizedPrivateKey.length === 0 ||
    !normalizedPrivateKey.includes('-----BEGIN PRIVATE KEY-----') ||
    !normalizedPrivateKey.includes('-----END PRIVATE KEY-----') ||
    isPrivateKeyPlaceholder(normalizedPrivateKey)
  ) {
    throw firestoreError(
      'Invalid FIREBASE_PRIVATE_KEY format. Expected a non-placeholder PKCS#8 private key.',
    )
  }

  await validateFirebasePrivateKey(normalizedPrivateKey)
}

/** Validate runtime configuration for non-test environments. */
export function validateRuntimeConfig(env: Bindings): Promise<void> {
  if (env.ENVIRONMENT === 'test') {
    return Promise.resolve()
  }

  if (!runtimeValidationPromise) {
    runtimeValidationPromise = runRuntimeValidation(env)
    // Attach a noop rejection handler to the cached promise so the Workers
    // runtime does not flag it as unhandled. Callers receive the same promise
    // and handle the rejection themselves.
    runtimeValidationPromise.catch(() => {})
  }

  return runtimeValidationPromise
}

/** Reset runtime validation cache for tests. */
export function resetRuntimeConfigValidation(): void {
  runtimeValidationPromise = null
}
