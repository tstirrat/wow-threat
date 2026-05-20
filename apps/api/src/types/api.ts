/**
 * API Contract Types
 *
 * Frontend-facing response contracts for the public HTTP API.
 * Shared types are defined in @wow-threat/shared/src/api-types.ts; this file
 * re-exports them for local convenience.
 */
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
