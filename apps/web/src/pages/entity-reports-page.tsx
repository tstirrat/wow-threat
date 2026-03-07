/**
 * Entity report listing page (guild implementation with generic route shape).
 */
import { ExternalLink } from 'lucide-react'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'

import { ErrorState } from '../components/error-state'
import { LoadingState } from '../components/loading-state'
import { ReportStarButton } from '../components/report-star-button'
import { SectionCard } from '../components/section-card'
import { StarredGuildReportsList } from '../components/starred-guild-reports-list'
import { Button } from '../components/ui/button'
import { useEntityReports } from '../hooks/use-entity-reports'
import { useUserSettings } from '../hooks/use-user-settings'
import { defaultHost } from '../lib/constants'
import { buildGuildUrl } from '../lib/wcl-url'
import type { StarredGuildReportEntry, WarcraftLogsHost } from '../types/app'

interface LocationState {
  host?: WarcraftLogsHost
}

interface GuildReportsPageProps {
  entityId: string
}

function GuildReportsPage({ entityId }: GuildReportsPageProps): JSX.Element {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const locationState = location.state as LocationState | null
  const {
    settings,
    isLoading,
    isSaving,
    isEntityStarred,
    toggleStarredEntity,
  } = useUserSettings()
  const parsedGuildId = Number.parseInt(entityId, 10)
  const guildId = Number.isFinite(parsedGuildId) ? parsedGuildId : undefined
  const guildName = searchParams.get('name')?.trim() || undefined
  const serverSlug = searchParams.get('serverSlug')?.trim() || undefined
  const serverRegion = searchParams.get('serverRegion')?.trim() || undefined
  const {
    response,
    isLoading: isLoadingEntityReports,
    isRefreshing: isRefreshingEntityReports,
    error,
    refresh,
  } = useEntityReports({
    entityType: 'guild',
    guildId,
    guildName,
    serverSlug,
    serverRegion,
    limit: 20,
  })

  if (isLoadingEntityReports) {
    return (
      <>
        <title>Guild Reports | WOW Threat</title>
        <LoadingState message="Loading guild reports..." />
      </>
    )
  }

  if (error || !response) {
    return (
      <>
        <title>Guild Reports | WOW Threat</title>
        <ErrorState
          title="Unable to load guild reports"
          message={error?.message ?? 'No guild report data was returned.'}
        />
      </>
    )
  }

  const existingStarredGuild = settings.starredEntities.find(
    (entry) =>
      entry.entityType === 'guild' &&
      entry.entityId === String(response.entity.id),
  )
  const sourceHost =
    locationState?.host ?? existingStarredGuild?.sourceHost ?? defaultHost
  const guildWclUrl = buildGuildUrl(sourceHost, {
    guildId,
    guildName: guildName ?? response.entity.name,
    serverSlug: serverSlug ?? response.entity.serverSlug ?? undefined,
    serverRegion: serverRegion ?? response.entity.serverRegion ?? undefined,
  })
  const guildReports: StarredGuildReportEntry[] = response.reports.map(
    (report) => ({
      reportId: report.code,
      title: report.title,
      startTime: report.startTime,
      endTime: report.endTime,
      zoneName: report.zoneName,
      guildId: String(response.entity.id),
      guildName: report.guildName ?? response.entity.name,
      guildFaction: report.guildFaction ?? response.entity.faction,
      sourceHost,
    }),
  )
  const isGuildStarred = isEntityStarred('guild', String(response.entity.id))
  const serverLabel =
    response.entity.serverRegion && response.entity.serverSlug
      ? `${response.entity.serverRegion}-${response.entity.serverSlug}`
      : 'Unknown realm'

  return (
    <>
      <title>{`<${response.entity.name}> Reports | WOW Threat`}</title>
      <SectionCard
        title={`<${response.entity.name}>`}
        subtitle={`Realm: ${serverLabel}`}
        headerRight={
          <div className="flex items-center gap-2">
            {guildWclUrl ? (
              <a
                aria-label="View on Warcraft Logs"
                className="inline-flex items-center gap-1 text-xs font-medium leading-none hover:opacity-80"
                href={guildWclUrl}
                rel="noopener noreferrer"
                target="_blank"
                title="View on Warcraft Logs"
              >
                <span>WCL</span>
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            ) : null}
            <Button
              disabled={isRefreshingEntityReports}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                void refresh()
              }}
            >
              {isRefreshingEntityReports ? 'Refreshing...' : 'Refresh'}
            </Button>
            <ReportStarButton
              ariaLabel={`${isGuildStarred ? 'Unstar' : 'Star'} guild ${response.entity.name}`}
              isDisabled={isLoading || isSaving}
              isStarred={isGuildStarred}
              onToggle={() => {
                void toggleStarredEntity({
                  entityType: 'guild',
                  entityId: String(response.entity.id),
                  name: response.entity.name,
                  sourceHost,
                  faction: response.entity.faction,
                  serverSlug: response.entity.serverSlug,
                  serverRegion: response.entity.serverRegion,
                })
              }}
            />
          </div>
        }
      >
        <StarredGuildReportsList reports={guildReports} />
      </SectionCard>
    </>
  )
}

/** Render reports for a selected entity route. */
export function EntityReportsPage(): JSX.Element {
  const params = useParams<{ entityType: string; entityId: string }>()
  if (params.entityType !== 'guild') {
    return (
      <>
        <title>Entity Reports | WOW Threat</title>
        <ErrorState
          title="Unsupported entity type"
          message={`Entity type "${params.entityType ?? 'unknown'}" is not supported yet.`}
        />
      </>
    )
  }
  if (!params.entityId) {
    return (
      <>
        <title>Entity Reports | WOW Threat</title>
        <ErrorState
          title="Invalid entity route"
          message="Missing entity identifier."
        />
      </>
    )
  }

  return <GuildReportsPage entityId={params.entityId} />
}
