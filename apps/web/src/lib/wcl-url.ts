/**
 * Warcraft Logs URL parsing and link-building helpers.
 */
import type { WarcraftLogsHost } from '../types/app'

export interface ParsedReportInput {
  reportId: string
  host: WarcraftLogsHost
}

const supportedHosts = new Set<WarcraftLogsHost>([
  'fresh.warcraftlogs.com',
  'sod.warcraftlogs.com',
  'vanilla.warcraftlogs.com',
])

/** Parse a report URL into host + report ID when possible. */
export function parseWarcraftLogsReportUrl(
  input: string,
): ParsedReportInput | null {
  const trimmed = input.trim()

  try {
    const url = new URL(trimmed)
    if (!supportedHosts.has(url.host as WarcraftLogsHost)) {
      return null
    }

    const match = url.pathname.match(/^\/reports\/([a-zA-Z0-9-]+)$/)
    if (!match?.[1]) {
      return null
    }

    return {
      reportId: match[1],
      host: url.host as WarcraftLogsHost,
    }
  } catch {
    return null
  }
}

/** Parse either a full WCL report URL or a raw report code. */
export function parseReportInput(
  input: string,
  fallbackHost: WarcraftLogsHost,
): ParsedReportInput | null {
  const parsedUrl = parseWarcraftLogsReportUrl(input)
  if (parsedUrl) {
    return parsedUrl
  }

  const trimmed = input.trim()
  if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) {
    return null
  }

  return {
    reportId: trimmed,
    host: fallbackHost,
  }
}

/** Build a WCL report URL from host + report ID. */
export function buildReportUrl(
  host: WarcraftLogsHost,
  reportId: string,
): string {
  return `https://${host}/reports/${reportId}`
}

/** Build a WCL rankings URL deep-linked to a fight. */
export function buildFightRankingsUrl(
  host: WarcraftLogsHost,
  reportId: string,
  fightId: number,
): string {
  const url = new URL(buildReportUrl(host, reportId))
  url.searchParams.set('view', 'rankings')
  url.searchParams.set('fight', String(fightId))
  return url.toString()
}
