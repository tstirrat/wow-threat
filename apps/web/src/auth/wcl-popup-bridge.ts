/**
 * LocalStorage bridge helpers for popup-based Warcraft Logs OAuth completion.
 */
export const wclAuthPopupResultStorageKey = 'wow-threat.wcl-auth-popup-result'

interface WclAuthPopupResultBase {
  createdAtMs: number
}

export interface WclAuthPopupSuccessResult extends WclAuthPopupResultBase {
  bridgeCode: string
  status: 'success'
}

export interface WclAuthPopupErrorResult extends WclAuthPopupResultBase {
  message: string
  status: 'error'
}

export type WclAuthPopupResult =
  | WclAuthPopupSuccessResult
  | WclAuthPopupErrorResult

/** Build a success payload from a bridge code. */
export function createWclAuthPopupSuccessResult(
  bridgeCode: string,
): WclAuthPopupSuccessResult {
  return {
    bridgeCode,
    createdAtMs: Date.now(),
    status: 'success',
  }
}

/** Build an error payload from a callback failure message. */
export function createWclAuthPopupErrorResult(
  message: string,
): WclAuthPopupErrorResult {
  return {
    createdAtMs: Date.now(),
    message,
    status: 'error',
  }
}

/** Parse a raw localStorage value into a typed popup result. */
export function parseWclAuthPopupResult(
  rawValue: string | null,
): WclAuthPopupResult | null {
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as {
      bridgeCode?: unknown
      createdAtMs?: unknown
      message?: unknown
      status?: unknown
    }

    if (
      parsed.status === 'success' &&
      typeof parsed.bridgeCode === 'string' &&
      parsed.bridgeCode.length > 0 &&
      typeof parsed.createdAtMs === 'number'
    ) {
      return {
        bridgeCode: parsed.bridgeCode,
        createdAtMs: parsed.createdAtMs,
        status: 'success',
      }
    }

    if (
      parsed.status === 'error' &&
      typeof parsed.message === 'string' &&
      parsed.message.length > 0 &&
      typeof parsed.createdAtMs === 'number'
    ) {
      return {
        createdAtMs: parsed.createdAtMs,
        message: parsed.message,
        status: 'error',
      }
    }
  } catch {
    return null
  }

  return null
}

/** Persist a popup result into localStorage for the main window to consume. */
export function publishWclAuthPopupResult(result: WclAuthPopupResult): void {
  window.localStorage.setItem(
    wclAuthPopupResultStorageKey,
    JSON.stringify(result),
  )
}

/** Read and parse the latest popup result from localStorage. */
export function readWclAuthPopupResult(): WclAuthPopupResult | null {
  return parseWclAuthPopupResult(
    window.localStorage.getItem(wclAuthPopupResultStorageKey),
  )
}

/** Clear any stale popup result from localStorage. */
export function clearWclAuthPopupResult(): void {
  window.localStorage.removeItem(wclAuthPopupResultStorageKey)
}
