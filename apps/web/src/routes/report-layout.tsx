/**
 * Shared report route layout: fills the rail outline and bar title, renders the outlet full height.
 */
import { type ThreatConfigId, threatConfigIds } from '@wow-threat/config'
import { usePostHog } from 'posthog-js/react'
import { type FC, useEffect, useRef } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'

import { ErrorState } from '../components/error-state'
import { FightCrumb, ReportCrumb } from '../components/fight-crumb'
import {
  ReportOutline,
  ReportOutlineSkeleton,
} from '../components/report-outline'
import { useReportData } from '../hooks/use-report-data'
import { useReportIndex } from '../hooks/use-report-index'
import { useUserSettings } from '../hooks/use-user-settings'
import { buildBossKillNavigationFights } from '../lib/fight-navigation'
import { formatClockDuration } from '../lib/format'
import { parseBooleanQueryParam } from '../lib/query-params'
import { parsePlayersParam } from '../lib/search-params'
import {
  readForcedThreatConfigParam,
  resolveCurrentThreatConfig,
} from '../lib/threat-config'
import type { ReportFightSummary } from '../types/api'
import type { WarcraftLogsHost } from '../types/app'
import { useBarTitle, useRailReportSection } from './app-shell-context'
import type { ReportRouteContext } from './report-layout-context'

interface LocationState {
  host?: WarcraftLogsHost
}

type ReportBarTitleProps = {
  reportId: string
  reportTitle: string
  fights: ReportFightSummary[]
  selectedFight: ReportFightSummary | null
  configId: ThreatConfigId | null
  eventsMode: string | null
  forceFresh: boolean
  pinnedPlayerIds: number[]
}

/** Breadcrumb for the app bar: report crumb, then the fight crumb menu when on a fight. */
const ReportBarTitle: FC<ReportBarTitleProps> = ({
  reportId,
  reportTitle,
  fights,
  selectedFight,
  configId,
  eventsMode,
  forceFresh,
  pinnedPlayerIds,
}) => (
  <>
    <ReportCrumb reportId={reportId} reportTitle={reportTitle} />
    {selectedFight ? (
      <FightCrumb
        configId={configId}
        eventsMode={eventsMode}
        fightLabel={`${selectedFight.name} · ${selectedFight.kill ? 'Kill' : 'Wipe'} · ${formatClockDuration(selectedFight.endTime - selectedFight.startTime)}`}
        fightShortLabel={selectedFight.name}
        fights={fights}
        forceFresh={forceFresh}
        pinnedPlayerIds={pinnedPlayerIds}
        reportId={reportId}
        selectedFightId={selectedFight.id}
      />
    ) : null}
  </>
)

/** Render report-scoped chrome shared by report landing and fight pages. */
export const ReportLayout: FC = () => {
  const params = useParams<{ reportId: string; fightId?: string }>()
  const reportId = params.reportId ?? ''
  const fightId = Number.parseInt(params.fightId ?? '', 10)

  const location = useLocation()
  const locationState = location.state as LocationState | null
  const queryParams = new URLSearchParams(location.search)
  const pinnedPlayerIds = parsePlayersParam(queryParams.get('pinnedPlayers'))
  const forceFresh = parseBooleanQueryParam(queryParams.get('fresh')) ?? false
  const eventsMode = queryParams.get('eventsMode')
  const forcedThreatConfig = readForcedThreatConfigParam(
    queryParams.get('config'),
  )

  const posthog = usePostHog()
  const reportLoadedCapturedRef = useRef<string | null>(null)
  const { addRecentReport, resolveReportHost } = useReportIndex()
  const {
    isLoading: isUserSettingsLoading,
    isSaving: isSavingUserSettings,
    isReportStarred,
    toggleStarredReport,
  } = useUserSettings()
  const fallbackHost = resolveReportHost(reportId)
  const reportHost = locationState?.host ?? fallbackHost
  const { data, isLoading, error } = useReportData(reportId)

  useEffect(() => {
    if (!data) return
    const bossKillFights = buildBossKillNavigationFights(data.fights)
    addRecentReport({
      reportId,
      title: data.title,
      sourceHost: reportHost,
      lastOpenedAt: Date.now(),
      zoneName: data.zone?.name,
      startTime: data.startTime,
      bossKillCount: bossKillFights.length,
      guildName: data.guild?.name ?? null,
      guildFaction: data.guild?.faction ?? null,
      isArchived: data.archiveStatus?.isArchived ?? false,
      isAccessible: data.archiveStatus?.isAccessible ?? true,
      archiveDate: data.archiveStatus?.archiveDate ?? null,
    })
  }, [addRecentReport, data, reportHost, reportId])

  useEffect(() => {
    if (!data || !posthog) return
    if (reportLoadedCapturedRef.current === reportId) return
    reportLoadedCapturedRef.current = reportId
    posthog.capture('report_loaded', {
      report_id: reportId,
      fight_count: buildBossKillNavigationFights(data.fights).length,
      duration_ms: data.endTime - data.startTime,
    })
  }, [data, posthog, reportId])

  const reportTitle = data ? data.title.trim() || reportId : reportId
  const selectedFightId = Number.isNaN(fightId) ? null : fightId
  const selectedFight =
    data?.fights.find((fight) => fight.id === selectedFightId) ?? null
  const threatConfig = data
    ? resolveCurrentThreatConfig(data, forcedThreatConfig.configId)
    : null
  const threatConfigLabel = threatConfig
    ? `${threatConfig.displayName} v${threatConfig.version}`
    : 'No supported config'

  useBarTitle(
    data && reportId ? (
      <ReportBarTitle
        configId={forcedThreatConfig.configId}
        eventsMode={eventsMode}
        fights={data.fights}
        forceFresh={forceFresh}
        pinnedPlayerIds={pinnedPlayerIds}
        reportId={reportId}
        reportTitle={reportTitle}
        selectedFight={selectedFight}
      />
    ) : null,
  )
  useRailReportSection(
    data && reportId && !forcedThreatConfig.isInvalid ? (
      <ReportOutline
        configId={forcedThreatConfig.configId}
        eventsMode={eventsMode}
        forceFresh={forceFresh}
        isStarToggleDisabled={isUserSettingsLoading || isSavingUserSettings}
        isStarred={isReportStarred(reportId)}
        onToggleStar={() => {
          void toggleStarredReport({
            reportId,
            title: data.title || reportId,
            sourceHost: reportHost,
            zoneName: data.zone?.name ?? null,
            startTime: data.startTime,
            bossKillCount: buildBossKillNavigationFights(data.fights).length,
            guildName: data.guild?.name ?? null,
            guildFaction: data.guild?.faction ?? null,
          })
        }}
        pinnedPlayerIds={pinnedPlayerIds}
        report={data}
        reportHost={reportHost}
        reportId={reportId}
        selectedFightId={selectedFightId}
        threatConfigLabel={threatConfigLabel}
      />
    ) : isLoading && reportId ? (
      <ReportOutlineSkeleton />
    ) : null,
  )

  if (forcedThreatConfig.isInvalid) {
    return (
      <>
        <title>{`${reportId || 'Report'} | WOW Threat`}</title>
        <ErrorState
          message={`Unknown threat config "${forcedThreatConfig.rawValue}". Use one of: ${threatConfigIds.join(', ')}.`}
          title="Unknown threat config"
        />
      </>
    )
  }

  if (!reportId) {
    return (
      <>
        <title>Report | WOW Threat</title>
        <ErrorState
          message="The report route is missing a report code."
          title="Invalid report route"
        />
      </>
    )
  }

  if (isLoading) {
    return (
      <>
        <title>{`${reportId} | WOW Threat`}</title>
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <title>{`${reportId} | WOW Threat`}</title>
        <ErrorState
          message={error?.message ?? 'Report data was not returned.'}
          title="Unable to load report"
        />
      </>
    )
  }

  const outletContext: ReportRouteContext = {
    reportId,
    reportData: data,
    reportHost,
  }

  return (
    <>
      <title>{`${reportTitle} | WOW Threat`}</title>
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <Outlet context={outletContext} />
        </div>
      </div>
    </>
  )
}

// for chunking, to make these both use the same chunk
export { ReportPage } from '../pages/report-page'
