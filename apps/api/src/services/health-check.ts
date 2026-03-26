/**
 * Health check service for verifying downstream dependency connectivity.
 *
 * Runs parallel probes against KV, Firestore, and WCL API with individual
 * timeouts. Each checker returns a DependencyStatus and never throws.
 */
import type {
  Bindings,
  DependencyStatus,
  HealthCheckResult,
} from '../types/bindings'
import { FirestoreClient } from './firestore-client'

const WCL_TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token'
const KV_HEALTH_KEY = 'health:ping'
const KV_TIMEOUT_MS = 2_000
const FIRESTORE_TIMEOUT_MS = 3_000
const WCL_TIMEOUT_MS = 3_000

function timeoutRace<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout])
}

function elapsed(start: number): number {
  return Date.now() - start
}

/** Check KV store by writing a sentinel key and reading it back. */
export async function checkKV(env: Bindings): Promise<DependencyStatus> {
  const start = Date.now()
  try {
    await timeoutRace(
      (async () => {
        await env.WCL_CACHE.put(KV_HEALTH_KEY, 'ok', { expirationTtl: 60 })
        const value = await env.WCL_CACHE.get(KV_HEALTH_KEY)
        // null is acceptable: KV is eventually consistent across edge locations,
        // so a get() immediately after put() may return null at a different PoP.
        // The put succeeding without throwing is sufficient proof of write access.
        if (value !== null && value !== 'ok') {
          throw new Error('KV read-back mismatch')
        }
      })(),
      KV_TIMEOUT_MS,
    )
    return { status: 'ok', latencyMs: elapsed(start) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown KV error'
    return { status: 'error', latencyMs: elapsed(start), message }
  }
}

/** Check Firestore connectivity. A 404 (document not found) is treated as success. */
export async function checkFirestore(env: Bindings): Promise<DependencyStatus> {
  const start = Date.now()
  try {
    await timeoutRace(
      new FirestoreClient(env).getDocument('_health', 'ping'),
      FIRESTORE_TIMEOUT_MS,
    )
    return { status: 'ok', latencyMs: elapsed(start) }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown Firestore error'
    return { status: 'error', latencyMs: elapsed(start), message }
  }
}

/** Check WCL API reachability via a client-credentials token request. */
export async function checkWCL(env: Bindings): Promise<DependencyStatus> {
  const start = Date.now()
  try {
    await timeoutRace(
      (async () => {
        const credentials = btoa(
          `${env.WCL_CLIENT_ID}:${env.WCL_CLIENT_SECRET}`,
        )
        const response = await fetch(WCL_TOKEN_URL, {
          body: new URLSearchParams({ grant_type: 'client_credentials' }),
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          method: 'POST',
        })
        if (!response.ok) {
          throw new Error(
            `WCL token endpoint responded with ${response.status}`,
          )
        }
      })(),
      WCL_TIMEOUT_MS,
    )
    return { status: 'ok', latencyMs: elapsed(start) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown WCL error'
    return { status: 'error', latencyMs: elapsed(start), message }
  }
}

/** Run all dependency checks in parallel and compute the aggregate status. */
export async function runHealthChecks(
  env: Bindings,
): Promise<HealthCheckResult> {
  const [kvResult, firestoreResult, wclResult] = await Promise.all([
    checkKV(env),
    checkFirestore(env),
    checkWCL(env),
  ])

  const allError =
    kvResult.status === 'error' &&
    firestoreResult.status === 'error' &&
    wclResult.status === 'error'

  const anyError =
    kvResult.status === 'error' ||
    firestoreResult.status === 'error' ||
    wclResult.status === 'error'

  const aggregateStatus = allError ? 'error' : anyError ? 'degraded' : 'ok'

  return {
    status: aggregateStatus,
    dependencies: {
      kv: kvResult,
      firestore: firestoreResult,
      wcl: wclResult,
    },
  }
}
