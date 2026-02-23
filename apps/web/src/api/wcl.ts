/**
 * API functions for Warcraft Logs account-level metadata.
 */
import { defaultApiBaseUrl } from '../lib/constants'
import type { WclRateLimitResponse } from '../types/api'
import { requestJson } from './client'

/** Fetch current WCL GraphQL rate-limit usage for this API key. */
export function getWclRateLimitData(): Promise<WclRateLimitResponse> {
  return requestJson<WclRateLimitResponse>(
    `${defaultApiBaseUrl}/auth/wcl/rate-limit`,
  )
}

export const wclRateLimitQueryKey = (
  uid: string | null,
): readonly ['wcl-rate-limit', string | null] => ['wcl-rate-limit', uid]
