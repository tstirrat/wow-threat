/**
 * Threat config resolution helpers for report metadata.
 */
import {
  type ThreatConfigId,
  getThreatConfigById,
  parseThreatConfigId,
  resolveConfigOrNull,
} from '@wow-threat/config'
import type { ThreatConfig } from '@wow-threat/shared'

import type { ReportResponse } from '../types/api'

export const THREAT_CONFIG_QUERY_PARAM = 'config'

export interface ForcedThreatConfigSelection {
  configId: ThreatConfigId | null
  isInvalid: boolean
  rawValue: string | null
}

/** Read the `config` query param. A blank value keeps automatic detection. */
export function readForcedThreatConfigParam(
  raw: string | null,
): ForcedThreatConfigSelection {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) {
    return {
      configId: null,
      isInvalid: false,
      rawValue: null,
    }
  }

  const configId = parseThreatConfigId(trimmed)
  if (!configId) {
    return {
      configId: null,
      isInvalid: true,
      rawValue: trimmed,
    }
  }

  return {
    configId,
    isInvalid: false,
    rawValue: trimmed,
  }
}

/** Cache token for a forced config, including that config's own version. */
export function threatConfigCacheScope(
  configId: ThreatConfigId | null,
): string | null {
  if (!configId) {
    return null
  }

  return `${configId}@${String(getThreatConfigById(configId).version)}`
}

/** Resolve the active threat config from report metadata or a forced config id. */
export function resolveCurrentThreatConfig(
  report: ReportResponse,
  configId: ThreatConfigId | null = null,
): ThreatConfig | null {
  if (configId) {
    return getThreatConfigById(configId)
  }

  return resolveConfigOrNull({
    report: {
      startTime: report.startTime,
      masterData: {
        gameVersion: report.gameVersion,
      },
      zone: report.zone ?? {},
      fights: report.fights.map((fight) => ({
        classicSeasonID: fight.classicSeasonID ?? null,
      })),
    },
  })
}
