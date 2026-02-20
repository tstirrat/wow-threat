/**
 * Warcraft Logs OAuth helpers for login, refresh, and user profile lookups.
 */
import { wclApiError } from '../middleware/error'
import type { Bindings } from '../types/bindings'

const WCL_AUTHORIZE_URL = 'https://www.warcraftlogs.com/oauth/authorize'
const WCL_TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token'
const WCL_USER_URL = 'https://www.warcraftlogs.com/api/v2/user'

export interface WclOAuthTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  token_type: string
}

export interface WclUserProfile {
  id: string
  name: string
}

/** Build a Warcraft Logs OAuth authorization URL. */
export function buildWclLoginUrl(env: Bindings, state: string): string {
  const url = new URL(WCL_AUTHORIZE_URL)
  url.searchParams.set('client_id', env.WCL_CLIENT_ID)
  url.searchParams.set('redirect_uri', env.WCL_OAUTH_REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)

  return url.toString()
}

async function requestWclToken(
  env: Bindings,
  body: URLSearchParams,
): Promise<WclOAuthTokenResponse> {
  const credentials = btoa(`${env.WCL_CLIENT_ID}:${env.WCL_CLIENT_SECRET}`)
  const response = await fetch(WCL_TOKEN_URL, {
    body,
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw wclApiError(
      `WCL token endpoint failed with status ${response.status}`,
    )
  }

  return (await response.json()) as WclOAuthTokenResponse
}

/** Exchange an authorization code for WCL user OAuth tokens. */
export async function exchangeWclAuthorizationCode(
  env: Bindings,
  code: string,
): Promise<WclOAuthTokenResponse> {
  return requestWclToken(
    env,
    new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: env.WCL_OAUTH_REDIRECT_URI,
    }),
  )
}

/** Refresh WCL OAuth tokens using a refresh token. */
export async function refreshWclAccessToken(
  env: Bindings,
  refreshToken: string,
): Promise<WclOAuthTokenResponse> {
  return requestWclToken(
    env,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  )
}

/** Fetch the current Warcraft Logs user profile from a user access token. */
export async function fetchCurrentWclUser(
  accessToken: string,
): Promise<WclUserProfile> {
  const response = await fetch(WCL_USER_URL, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw wclApiError(`Failed to fetch WCL user profile: ${response.status}`)
  }

  const payload = (await response.json()) as Record<string, unknown>
  const idCandidate =
    payload.id ?? payload.userId ?? payload.userID ?? payload.sub

  if (idCandidate == null) {
    throw wclApiError('WCL user profile did not include a user id')
  }

  const nameCandidate = payload.name ?? payload.username ?? payload.displayName
  const id = String(idCandidate)
  const name = typeof nameCandidate === 'string' ? nameCandidate : `wcl:${id}`

  return {
    id,
    name,
  }
}
