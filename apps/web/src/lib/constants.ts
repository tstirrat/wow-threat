/**
 * Shared constants used across the web app.
 */
import type { ExampleReportLink, WarcraftLogsHost } from '../types/app'

export const defaultApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'

export const recentReportsStorageKey = 'wow-threat.recent-reports'
export const accountRecentReportsStorageKey =
  'wow-threat.account-recent-reports'
export const accountRecentReportsCacheTtlMs = 1000 * 60 * 60
export const starredGuildReportsStorageKey = 'wow-threat.starred-guild-reports'
export const entityReportsStorageKey = 'wow-threat.entity-reports'
export const threatChartShowFixateBandsStorageKey =
  'wow-threat.threat-chart.show-fixate-bands'
export const starredGuildReportsCacheTtlMs = 1000 * 60 * 60
export const rosterHiddenStorageKey = 'wow-threat.roster-hidden'
export const playerInfoClosedStorageKey = 'wow-threat.player-info-closed'
export const playerInfoHeightStorageKey = 'wow-threat.player-info-height'
/** Matches Tailwind's `max-[760px]:` variant; below it the rail and roster go off-canvas. */
export const mobileLayoutMediaQuery = '(width < 760px)'
export const reportSearchIndexStorageKey = 'wow-threat.report-search-index'
export const reportSearchIndexRefreshIntervalMs = 1000 * 60 * 60
export const reportSearchIndexRetentionMs = 1000 * 60 * 60 * 24 * 30

export const defaultHost: WarcraftLogsHost = 'fresh.warcraftlogs.com'

export const exampleReports: ExampleReportLink[] = [
  {
    label: 'Fresh Example',
    reportId: 'T43YpndkCZ8zVayw',
    host: 'fresh.warcraftlogs.com',
    href: 'https://fresh.warcraftlogs.com/reports/T43YpndkCZ8zVayw?fight=15',
    zoneName: "Gruul's Lair / Magtheridon",
  },
  {
    label: 'SoD Example',
    reportId: 'gbQwq2kP9WH6yJMd',
    host: 'sod.warcraftlogs.com',
    href: 'https://sod.warcraftlogs.com/reports/gbQwq2kP9WH6yJMd?fight=17',
    zoneName: 'Scarlet Enclave',
  },
  {
    label: 'Vanilla Era Example',
    reportId: 'TGw2BFt7DVWgQh81',
    host: 'vanilla.warcraftlogs.com',
    href: 'https://vanilla.warcraftlogs.com/reports/TGw2BFt7DVWgQh81?fight=38',
    zoneName: 'Naxxramas',
  },
]
