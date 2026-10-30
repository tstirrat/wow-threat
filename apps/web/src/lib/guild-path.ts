/**
 * Guild report-list route builder for report guild metadata.
 */
import type { ReportResponse } from '../types/api'

/** Build the guild reports route for a report's guild, or null when it cannot be looked up. */
export function buildGuildEntityPath(report: ReportResponse): string | null {
  const guild = report.guild
  if (!guild) {
    return null
  }

  const hasGuildId = typeof guild.id === 'number' && Number.isFinite(guild.id)
  const hasLookupFallback = Boolean(guild.serverSlug && guild.serverRegion)
  if (!hasGuildId && !hasLookupFallback) {
    return null
  }

  const guildPathId = hasGuildId ? String(guild.id) : 'lookup'
  const searchParams = new URLSearchParams()
  searchParams.set('name', guild.name)
  if (guild.serverSlug) {
    searchParams.set('serverSlug', guild.serverSlug)
  }
  if (guild.serverRegion) {
    searchParams.set('serverRegion', guild.serverRegion)
  }
  const search = searchParams.toString()

  return `/reports/guild/${guildPathId}${search.length > 0 ? `?${search}` : ''}`
}
