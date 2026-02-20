/**
 * Encryption and random token helpers for auth services.
 */
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const normalized = base64.replace(/\s/g, '')
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function encodeBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')

  return base64ToBytes(padded)
}

/** Build a random base64url token. */
export function createRandomBase64Url(size = 32): string {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return encodeBase64Url(bytes)
}

/** Import a SHA256 HMAC key and derive a symmetric AES-GCM key. */
export async function importAesGcmKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    textEncoder.encode(secret),
  )

  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}

/** Encrypt a secret string with AES-GCM and return a versioned envelope. */
export async function encryptSecret(
  value: string,
  key: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
    },
    key,
    toArrayBuffer(textEncoder.encode(value)),
  )

  return `v1.${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(encrypted))}`
}

/** Decrypt a secret string encrypted by `encryptSecret`. */
export async function decryptSecret(
  value: string,
  key: CryptoKey,
): Promise<string> {
  const [version, ivPart, cipherPart] = value.split('.')
  if (version !== 'v1' || !ivPart || !cipherPart) {
    throw new Error('Invalid encrypted secret payload')
  }

  const iv = decodeBase64Url(ivPart)
  const cipher = decodeBase64Url(cipherPart)
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
    },
    key,
    toArrayBuffer(cipher),
  )

  return textDecoder.decode(decrypted)
}
