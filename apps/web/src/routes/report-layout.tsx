/**
 * Shared report route layout with compact header and fight quick switcher.
 */
import { type FC, useEffect } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'

import { ErrorState } from '../components/error-state'
import { FightQuickSwitcher } from '../components/fight-quick-switcher'
import { FightSearchDialog } from '../components/fight-search-dialog'
import {
  ReportSummaryHeader,
  ReportSummaryHeaderSkeleton,
} from '../components/report-summary-header'
import { useFightSearch } from '../hooks/use-fight-search'
import { useReportData } from '../hooks/use-report-data'
import { useReportIndex } from '../hooks/use-report-index'
import { useUserSettings } from '../hooks/use-user-settings'
import {
  buildBossKillNavigationFights,
  buildFightNavigationPath,
} from '../lib/fight-navigation'
import { parsePlayersParam } from '../lib/search-params'
import { resolveCurrentThreatConfig } from '../lib/threat-config'
import type { WarcraftLogsHost } from '../types/app'
import type { ReportRouteContext } from './report-layout-context'

interface LocationState {
  host?: WarcraftLogsHost
}

/** Render report-scoped chrome shared by report landing and fight pages. */
export const ReportLayout: FC = () => {
  const params = useParams<{ reportId: string; fightId?: string }>()
  const reportId = params.reportId ?? ''
  const fightId = Number.parseInt(params.fightId ?? '', 10)
  const navigate = useNavigate()

  const location = useLocation()
  const locationState = location.state as LocationState | null
  const pinnedPlayerIds = parsePlayersParam(
    new URLSearchParams(location.search).get('pinnedPlayers'),
  )

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
  const {
    isOpen: isFightSearchOpen,
    query: fightSearchQuery,
    options: fightSearchOptions,
    highlightedFightId,
    open: openFightSearch,
    close: closeFightSearch,
    setQuery: setFightSearchQuery,
    setHighlightedFightId,
    handleInputKeyDown,
    selectFight,
  } = useFightSearch({
    fights: data?.fights ?? [],
    onSelectFight: (selectedId) => {
      navigate(
        buildFightNavigationPath({
          reportId,
          fightId: selectedId,
          pinnedPlayerIds,
        }),
      )
    },
  })

  useHotkeys(
    'f',
    (event) => {
      if (!event.target) {
        return
      }

      const targetElement = event.target as HTMLElement
      if (
        targetElement.closest(
          'input, textarea, select, button, [contenteditable]',
        )
      ) {
        return
      }

      event.preventDefault()
      openFightSearch()
    },
    {
      description: 'Open fight search',
      enableOnFormTags: false,
      metadata: {
        order: 65,
        showInFightOverlay: true,
      },
    },
    [openFightSearch],
  )

  useEffect(() => {
    if (!data) {
      return
    }

    addRecentReport({
      reportId,
      title: data.title,
      sourceHost: reportHost,
      lastOpenedAt: Date.now(),
      zoneName: data.zone?.name,
      startTime: data.startTime,
      bossKillCount: buildBossKillNavigationFights(data.fights).length,
      guildName: data.guild?.name ?? null,
      guildFaction: data.guild?.faction ?? null,
      isArchived: data.archiveStatus?.isArchived ?? false,
      isAccessible: data.archiveStatus?.isAccessible ?? true,
      archiveDate: data.archiveStatus?.archiveDate ?? null,
    })
  }, [addRecentReport, data, reportHost, reportId])

  if (!reportId) {
    return (
      <ErrorState
        message="The report route is missing a report code."
        title="Invalid report route"
      />
    )
  }

  if (isLoading) {
    return <ReportSummaryHeaderSkeleton />
  }

  if (error || !data) {
    return (
      <ErrorState
        message={error?.message ?? 'Report data was not returned.'}
        title="Unable to load report"
      />
    )
  }

  const threatConfig = resolveCurrentThreatConfig(data)
  const threatConfigLabel = threatConfig
    ? `${threatConfig.displayName} v${threatConfig.version}`
    : 'No supported config'
  const selectedFightId = Number.isNaN(fightId) ? null : fightId
  const outletContext: ReportRouteContext = {
    reportId,
    reportData: data,
    reportHost,
  }

  return (
    <div className="space-y-5">
      <ReportSummaryHeader
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
        report={data}
        reportHost={reportHost}
        reportId={reportId}
        selectedFightId={selectedFightId}
        threatConfigLabel={threatConfigLabel}
      />
      <FightQuickSwitcher
        fights={data.fights}
        pinnedPlayerIds={pinnedPlayerIds}
        reportId={reportId}
        selectedFightId={selectedFightId}
      />
      <FightSearchDialog
        highlightedFightId={highlightedFightId}
        isOpen={isFightSearchOpen}
        options={fightSearchOptions}
        query={fightSearchQuery}
        onClose={closeFightSearch}
        onHighlightFight={setHighlightedFightId}
        onInputKeyDown={handleInputKeyDown}
        onQueryChange={setFightSearchQuery}
        onSelectFight={selectFight}
      />
      <Outlet context={outletContext} />
    </div>
  )
}

// for chunking, to make these both use the same chunk
export { ReportPage } from '../pages/report-page'
