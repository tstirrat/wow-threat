/**
 * Firebase Authentication token helpers.
 */
import {
  type JWTPayload,
  SignJWT,
  createRemoteJWKSet,
  importPKCS8,
  jwtVerify,
} from 'jose'

import { unauthorized } from '../middleware/error'
import type { Bindings } from '../types/bindings'

const FIREBASE_SECURETOKEN_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
const FIREBASE_CUSTOM_TOKEN_AUDIENCE =
  'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit'

const firebaseJwks = createRemoteJWKSet(new URL(FIREBASE_SECURETOKEN_JWKS_URL))

let firebaseServiceAccountPrivateKeyPromise: Promise<CryptoKey> | null = null

interface FirebaseIdTokenPayload extends JWTPayload {
  auth_time?: number
  user_id?: string
}

export interface VerifiedFirebaseIdToken {
  uid: string
  claims: FirebaseIdTokenPayload
}

export interface FirebaseCustomTokenPayload {
  uid: string
  claims?: Record<string, unknown>
}

async function getFirebaseServiceAccountPrivateKey(
  env: Bindings,
): Promise<CryptoKey> {
  if (!firebaseServiceAccountPrivateKeyPromise) {
    const pem = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    firebaseServiceAccountPrivateKeyPromise = importPKCS8(pem, 'RS256')
  }

  return firebaseServiceAccountPrivateKeyPromise
}

function validateFirebaseClaims(
  payload: FirebaseIdTokenPayload,
): VerifiedFirebaseIdToken {
  const nowSeconds = Math.floor(Date.now() / 1000)

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw unauthorized('Invalid Firebase subject')
  }
  if (payload.sub.length > 128) {
    throw unauthorized('Invalid Firebase subject length')
  }
  if (
    typeof payload.auth_time === 'number' &&
    payload.auth_time > nowSeconds + 300
  ) {
    throw unauthorized('Firebase ID token auth_time is invalid')
  }

  return {
    uid: typeof payload.user_id === 'string' ? payload.user_id : payload.sub,
    claims: payload,
  }
}

/** Verify and decode a Firebase ID token for the configured project. */
export async function verifyFirebaseIdToken(
  idToken: string,
  env: Bindings,
): Promise<VerifiedFirebaseIdToken> {
  if (env.ENVIRONMENT === 'test') {
    const [prefix, testUid, tokenState] = idToken.split(':')
    if (prefix !== 'test-firebase-id-token') {
      throw unauthorized('Invalid Firebase ID token')
    }
    if (tokenState === 'expired') {
      throw unauthorized('Firebase ID token is expired')
    }

    const uid = testUid || 'wcl-test-user'

    return {
      uid,
      claims: {
        aud: env.FIREBASE_PROJECT_ID,
        iss: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
        sub: uid,
      },
    }
  }

  const expectedIssuer = `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`
  let payload: JWTPayload

  try {
    const verified = await jwtVerify(idToken, firebaseJwks, {
      algorithms: ['RS256'],
      audience: env.FIREBASE_PROJECT_ID,
      issuer: expectedIssuer,
    })
    payload = verified.payload
  } catch {
    throw unauthorized('Invalid Firebase ID token')
  }

  return validateFirebaseClaims(payload as FirebaseIdTokenPayload)
}

/** Create a Firebase custom token signed by the configured service account key. */
export async function createFirebaseCustomToken(
  payload: FirebaseCustomTokenPayload,
  env: Bindings,
): Promise<string> {
  if (!payload.uid || payload.uid.length > 128) {
    throw unauthorized('Invalid uid for Firebase custom token')
  }

  if (env.ENVIRONMENT === 'test') {
    return `test-custom-token:${payload.uid}`
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const privateKey = await getFirebaseServiceAccountPrivateKey(env)
  const claims: Record<string, unknown> = {
    uid: payload.uid,
  }

  if (payload.claims && Object.keys(payload.claims).length > 0) {
    claims.claims = payload.claims
  }

  return new SignJWT(claims)
    .setProtectedHeader({
      alg: 'RS256',
      typ: 'JWT',
    })
    .setAudience(FIREBASE_CUSTOM_TOKEN_AUDIENCE)
    .setIssuer(env.FIREBASE_CLIENT_EMAIL)
    .setSubject(env.FIREBASE_CLIENT_EMAIL)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + 3600)
    .sign(privateKey)
}
