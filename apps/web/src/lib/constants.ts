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
export const reportSearchIndexStorageKey = 'wow-threat.report-search-index'
export const reportSearchIndexRefreshIntervalMs = 1000 * 60 * 60
export const reportSearchIndexRetentionMs = 1000 * 60 * 60 * 24 * 30

export const defaultHost: WarcraftLogsHost = 'fresh.warcraftlogs.com'

export const exampleReports: ExampleReportLink[] = [
  {
    label: 'Fresh Example',
    reportId: 'f9yPamzBxQqhGndZ',
    host: 'fresh.warcraftlogs.com',
    href: 'https://fresh.warcraftlogs.com/reports/f9yPamzBxQqhGndZ?view=rankings&fight=26',
  },
  {
    label: 'SoD Example',
    reportId: 'DcCXarqJMBRkTPgA',
    host: 'sod.warcraftlogs.com',
    href: 'https://sod.warcraftlogs.com/reports/DcCXarqJMBRkTPgA?view=rankings&boss=-2&difficulty=0&wipes=2',
  },
  {
    label: 'Vanilla Era Example',
    reportId: 'DtFAg9L2WBZabRX8',
    host: 'vanilla.warcraftlogs.com',
    href: 'https://vanilla.warcraftlogs.com/reports/DtFAg9L2WBZabRX8?boss=-2&wipes=2&view=rankings&difficulty=0',
  },
]
