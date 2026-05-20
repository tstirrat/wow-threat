/**
 * Frontend API response contract types.
 *
 * Shared wire-contract types are re-exported from @wow-threat/shared.
 * AugmentedEventsResponse is web-only (uses AugmentedEvent from the threat engine).
 */
import type { AugmentedEvent } from '@wow-threat/shared'

export type {
  EntityReportSummary,
  EntityReportsResponse,
  EntitySummary,
  FightEventsResponse,
  FightsResponse,
  RecentReportSource,
  RecentReportSummary,
  RecentReportsResponse,
  ReportAbilitySummary,
  ReportActorRole,
  ReportActorSubType,
  ReportActorSummary,
  ReportActorType,
  ReportArchiveStatusSummary,
  ReportEntityType,
  ReportFightParticipant,
  ReportFightSummary,
  ReportGuildSummary,
  ReportResponse,
  ThreatConfigSummary,
  WclRateLimitResponse,
} from '@wow-threat/shared'

export interface AugmentedEventsResponse {
  reportCode: string
  fightId: number
  fightName: string
  gameVersion: number
  configVersion: string
  events: AugmentedEvent[]
  initialAurasByActor?: Record<string, number[]>
}
