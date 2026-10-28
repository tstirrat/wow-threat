/**
 * Fight workspace grid with named chart, roster, transport and drawer regions.
 */
import type { FC, ReactNode, Ref } from 'react'

export type FightWorkspaceProps = {
  label?: string
  chart: ReactNode
  roster?: ReactNode
  isRosterVisible?: boolean
  rosterRef?: Ref<HTMLDivElement>
  transport?: ReactNode
  drawer?: ReactNode
}

const workspaceGridClassName = [
  'grid h-full min-h-0 grid-cols-1 gap-3',
  "[grid-template-areas:'chart'_'roster'_'transport'_'drawer']",
  'lg:grid-rows-[minmax(0,1fr)_auto_auto]',
].join(' ')

const rosterVisibleGridClassName = [
  'lg:grid-cols-[minmax(0,1fr)_17rem]',
  "lg:[grid-template-areas:'chart_roster'_'transport_transport'_'drawer_drawer']",
].join(' ')

const rosterHiddenGridClassName = [
  'lg:grid-cols-[minmax(0,1fr)]',
  "lg:[grid-template-areas:'chart'_'transport'_'drawer']",
].join(' ')

/** Lay out the fight page regions; the roster fills the chart row without stretching it. */
export const FightWorkspace: FC<FightWorkspaceProps> = ({
  label = 'Fight workspace',
  chart,
  roster,
  isRosterVisible = true,
  rosterRef,
  transport,
  drawer,
}) => {
  return (
    <section
      aria-label={label}
      className={`${workspaceGridClassName} ${isRosterVisible ? rosterVisibleGridClassName : rosterHiddenGridClassName}`}
      data-testid="fight-workspace"
    >
      <div
        className="flex min-h-0 min-w-0 flex-col gap-3 rounded-lg bg-card p-4 text-xs/relaxed text-card-foreground ring-foreground/10 [grid-area:chart] dark:ring-1"
        data-region="chart"
      >
        {chart}
      </div>
      <div
        className={`relative min-h-0 min-w-0 [grid-area:roster] ${isRosterVisible ? '' : 'hidden'}`}
        data-region="roster"
      >
        <div className="flex flex-col lg:absolute lg:inset-0" ref={rosterRef}>
          {roster}
        </div>
      </div>
      {transport ? (
        <div className="min-w-0 [grid-area:transport]" data-region="transport">
          {transport}
        </div>
      ) : null}
      {drawer ? (
        <div className="min-w-0 [grid-area:drawer]" data-region="drawer">
          {drawer}
        </div>
      ) : null}
    </section>
  )
}
