/**
 * Loading skeletons for the fight workspace regions.
 */
import type { FC } from 'react'

import { FightWorkspace } from './fight-workspace'
import { FightWorkspaceHeader } from './fight-workspace-header'
import { Skeleton } from './ui/skeleton'

/** Chart-region placeholder while fight settings or events load. */
export const FightChartLoadingSkeleton: FC<{
  loadingMessage?: string
  showControlsSkeleton?: boolean
}> = ({
  loadingMessage = 'Loading fight events',
  showControlsSkeleton = true,
}) => {
  return (
    <section
      aria-label="Loading fight events chart"
      aria-live="polite"
      className="flex min-h-0 flex-1 flex-col gap-3"
      role="status"
    >
      {showControlsSkeleton ? (
        <div
          className="flex flex-wrap items-center gap-2"
          data-testid="fight-chart-controls-skeleton"
        >
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-52" />
        </div>
      ) : null}
      <div className="relative min-h-[560px] w-full flex-1">
        <Skeleton
          className="absolute inset-0"
          data-testid="fight-chart-skeleton"
        />
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
          {loadingMessage}
        </p>
      </div>
    </section>
  )
}

/** Roster-region placeholder while the legend is not yet available. */
export const FightRosterLoadingSkeleton: FC = () => {
  return (
    <Skeleton
      className="h-[560px] w-full lg:h-full"
      data-testid="fight-legend-skeleton"
    />
  )
}

/** Whole-workspace placeholder while fight metadata loads. */
export const FightPageLoadingSkeleton: FC = () => {
  return (
    <section
      aria-label="Loading fight data"
      aria-live="polite"
      className="h-full"
      role="status"
    >
      <FightWorkspace
        header={
          <FightWorkspaceHeader
            title={<Skeleton className="h-6 w-40" />}
            actions={
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-7 w-40" />
              </div>
            }
          />
        }
        chart={
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="min-h-[560px] w-full flex-1" />
          </div>
        }
        roster={<FightRosterLoadingSkeleton />}
      />
    </section>
  )
}
