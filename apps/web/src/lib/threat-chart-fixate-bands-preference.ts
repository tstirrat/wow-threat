/**
 * Local-storage helpers for threat chart fixate band visibility preference.
 */
import { threatChartShowFixateBandsStorageKey } from './constants'

const defaultShowFixateBands = true

function parseShowFixateBandsValue(raw: string | null): boolean | null {
  if (raw === 'true') {
    return true
  }

  if (raw === 'false') {
    return false
  }

  return null
}

/** Load the persisted fixate-band visibility preference from local storage. */
export function loadShowFixateBandsPreference(): boolean {
  if (typeof window === 'undefined') {
    return defaultShowFixateBands
  }

  try {
    return (
      parseShowFixateBandsValue(
        window.localStorage.getItem(threatChartShowFixateBandsStorageKey),
      ) ?? defaultShowFixateBands
    )
  } catch {
    return defaultShowFixateBands
  }
}

/** Persist fixate-band visibility preference to local storage. */
export function saveShowFixateBandsPreference(showFixateBands: boolean): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      threatChartShowFixateBandsStorageKey,
      String(showFixateBands),
    )
  } catch {
    // Swallow storage write failures and keep chart interaction responsive.
  }
}
