/**
 * Loading skeletons for the fight workspace regions.
 */
import type { FC } from 'react'

import { FightWorkspace } from './fight-workspace'
import { Skeleton } from './ui/skeleton'

/** Chart-region loading message while fight settings or events load. */
export const FightChartLoadingSkeleton: FC<{
  loadingMessage?: string
}> = ({ loadingMessage = 'Loading fight events' }) => {
  return (
    <section
      aria-label="Loading fight events chart"
      aria-live="polite"
      className="flex min-h-[240px] flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground"
      data-testid="fight-chart-loading"
      role="status"
    >
      <p>{loadingMessage}</p>
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
        chart={
          <div className="flex min-h-[240px] flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            Loading fight data
          </div>
        }
        roster={<FightRosterLoadingSkeleton />}
      />
    </section>
  )
}
