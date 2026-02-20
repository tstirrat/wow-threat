/**
 * Authentication routes for WCL OAuth and Firebase token bridging.
 */
import { Hono } from 'hono'
import { SignJWT, jwtVerify } from 'jose'

import { unauthorized } from '../middleware/error'
import { AuthStore } from '../services/auth-store'
import {
  createFirebaseCustomToken,
  verifyFirebaseIdToken,
} from '../services/firebase-auth'
import { isOriginAllowed, parseAllowedOrigins } from '../services/origins'
import { createRandomBase64Url } from '../services/token-utils'
import {
  buildWclLoginUrl,
  exchangeWclAuthorizationCode,
  fetchCurrentWclUser,
} from '../services/wcl-oauth'
import type { Bindings, Variables } from '../types/bindings'

const OAUTH_STATE_TTL_SECONDS = 600
const BRIDGE_CODE_TTL_SECONDS = 300

interface OAuthStatePayload {
  nonce: string
  origin: string
}

interface FirebaseCustomTokenRequest {
  bridgeCode?: unknown
}

function getStateSigningKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

async function createSignedOAuthState(
  origin: string,
  secret: string,
): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const signingKey = getStateSigningKey(secret)
  const payload = {
    nonce: createRandomBase64Url(12),
    origin,
  }

  return new SignJWT(payload)
    .setProtectedHeader({
      alg: 'HS256',
      typ: 'JWT',
    })
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + OAUTH_STATE_TTL_SECONDS)
    .sign(signingKey)
}

async function verifySignedOAuthState(
  signedState: string,
  secret: string,
): Promise<OAuthStatePayload | null> {
  const signingKey = getStateSigningKey(secret)

  try {
    const verified = await jwtVerify(signedState, signingKey, {
      algorithms: ['HS256'],
    })
    const origin = verified.payload.origin
    const nonce = verified.payload.nonce

    if (typeof origin !== 'string' || typeof nonce !== 'string') {
      return null
    }

    return {
      nonce,
      origin,
    }
  } catch {
    return null
  }
}

function resolveRequestedOrigin(
  requestedOrigin: string | undefined,
  allowedOrigins: string[],
): string {
  if (requestedOrigin) {
    if (!isOriginAllowed(requestedOrigin, allowedOrigins)) {
      throw unauthorized('Requested origin is not allowed')
    }
    return requestedOrigin
  }

  const fallbackOrigin = allowedOrigins[0]
  if (!fallbackOrigin) {
    throw unauthorized('No allowed origins configured')
  }

  return fallbackOrigin
}

function parseBearerToken(authHeader: string | undefined): string {
  if (!authHeader) {
    throw unauthorized('Missing Authorization header')
  }

  const [scheme, token] = authHeader.split(' ')
  if (scheme !== 'Bearer' || !token) {
    throw unauthorized('Invalid Authorization header format')
  }

  return token
}

export const authRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

/**
 * GET /auth/wcl/login
 * Redirects the user to Warcraft Logs OAuth.
 */
authRoutes.get('/wcl/login', async (c) => {
  const allowedOrigins = parseAllowedOrigins(c.env.ALLOWED_ORIGINS)
  const requestedOrigin = c.req.query('origin') ?? c.req.header('origin')
  const origin = resolveRequestedOrigin(requestedOrigin, allowedOrigins)
  const state = await createSignedOAuthState(
    origin,
    c.env.BRIDGE_CODE_SIGNING_SECRET,
  )
  const loginUrl = buildWclLoginUrl(c.env, state)

  return c.redirect(loginUrl, 302)
})

/**
 * GET /auth/wcl/callback
 * Handles WCL OAuth callback and redirects with a one-time bridge code.
 */
authRoutes.get('/wcl/callback', async (c) => {
  const oauthCode = c.req.query('code')
  const signedState = c.req.query('state')

  if (!oauthCode || !signedState) {
    throw unauthorized('Missing OAuth callback parameters')
  }

  const statePayload = await verifySignedOAuthState(
    signedState,
    c.env.BRIDGE_CODE_SIGNING_SECRET,
  )
  if (!statePayload) {
    throw unauthorized('Invalid OAuth state')
  }

  const allowedOrigins = parseAllowedOrigins(c.env.ALLOWED_ORIGINS)
  if (!isOriginAllowed(statePayload.origin, allowedOrigins)) {
    throw unauthorized('OAuth state origin is not allowed')
  }

  const tokenResponse = await exchangeWclAuthorizationCode(c.env, oauthCode)
  const wclUser = await fetchCurrentWclUser(tokenResponse.access_token)

  const uid = `wcl:${wclUser.id}`
  const authStore = new AuthStore(c.env)
  await authStore.saveWclTokens({
    accessToken: tokenResponse.access_token,
    accessTokenExpiresAtMs: Date.now() + tokenResponse.expires_in * 1000,
    refreshToken: tokenResponse.refresh_token ?? null,
    refreshTokenExpiresAtMs: null,
    tokenType: tokenResponse.token_type,
    uid,
    wclUserId: wclUser.id,
    wclUserName: wclUser.name,
  })

  const bridgeCode = await authStore.createBridgeCode(
    {
      uid,
      wclUserId: wclUser.id,
      wclUserName: wclUser.name,
    },
    BRIDGE_CODE_TTL_SECONDS,
  )
  const redirectUrl = new URL('/auth/complete', statePayload.origin)
  redirectUrl.hash = `bridge=${encodeURIComponent(bridgeCode)}`

  return c.redirect(redirectUrl.toString(), 302)
})

/**
 * POST /auth/firebase-custom-token
 * Exchanges a one-time bridge code for a Firebase custom token.
 */
authRoutes.post('/firebase-custom-token', async (c) => {
  const body = (await c.req.json()) as FirebaseCustomTokenRequest
  const bridgeCode =
    typeof body.bridgeCode === 'string' ? body.bridgeCode : undefined

  if (!bridgeCode) {
    throw unauthorized('Missing bridge code')
  }

  const authStore = new AuthStore(c.env)
  const bridgePayload = await authStore.consumeBridgeCode(bridgeCode)
  if (!bridgePayload) {
    throw unauthorized('Invalid or expired bridge code')
  }

  const customToken = await createFirebaseCustomToken(
    {
      claims: {
        wclUserId: bridgePayload.wclUserId,
        wclUserName: bridgePayload.wclUserName,
      },
      uid: bridgePayload.uid,
    },
    c.env,
  )

  return c.json({
    customToken,
    uid: bridgePayload.uid,
  })
})

/**
 * POST /auth/logout
 * Deletes persisted WCL OAuth tokens for the authenticated Firebase uid.
 */
authRoutes.post('/logout', async (c) => {
  const idToken = parseBearerToken(c.req.header('authorization'))
  const verifiedToken = await verifyFirebaseIdToken(idToken, c.env)
  const authStore = new AuthStore(c.env)
  await authStore.deleteWclTokens(verifiedToken.uid)

  return c.body(null, 204)
})
