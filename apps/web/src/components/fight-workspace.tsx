/**
 * Fight workspace grid with named chart, roster, transport and drawer regions.
 * Below 760px the roster is an off-canvas panel from the right and the chart and drawer become tabs.
 */
import { type FC, type ReactNode, type Ref, useState } from 'react'

import { Tabs, TabsList, TabsTrigger } from './ui/tabs'

export type FightWorkspaceTab = 'chart' | 'info'

export type FightWorkspaceProps = {
  label?: string
  chart: ReactNode
  roster?: ReactNode
  isRosterVisible?: boolean
  onCloseRoster?: () => void
  rosterRef?: Ref<HTMLDivElement>
  transport?: ReactNode
  drawer?: ReactNode
}

const workspaceGridClassName = [
  'grid h-full min-h-0 grid-cols-1 surface-panel',
  "[grid-template-areas:'chart'_'roster'_'transport'_'drawer']",
  'lg:grid-rows-[minmax(0,1fr)_auto_auto]',
  "max-[760px]:[grid-template-areas:'tabs'_'chart'_'transport']",
  'max-[760px]:grid-rows-[auto_minmax(0,1fr)_auto]',
].join(' ')

const rosterVisibleGridClassName = [
  'lg:grid-cols-[minmax(0,1fr)_17rem]',
  "lg:[grid-template-areas:'chart_roster'_'transport_roster'_'drawer_drawer']",
].join(' ')

const rosterHiddenGridClassName = [
  'lg:grid-cols-[minmax(0,1fr)]',
  "lg:[grid-template-areas:'chart'_'transport'_'drawer']",
].join(' ')

// Below 760px the roster slides over the workspace from the right.
const mobileRosterClassName = [
  'max-[760px]:fixed max-[760px]:inset-y-0 max-[760px]:right-0 max-[760px]:z-50',
  'max-[760px]:w-[min(320px,88vw)] max-[760px]:border-l max-[760px]:border-border',
  'max-[760px]:border-t-0 max-[760px]:surface-panel max-[760px]:shadow-2xl',
].join(' ')

type MobileTabsProps = {
  activeTab: FightWorkspaceTab
  onActiveTabChange: (tab: FightWorkspaceTab) => void
}

const isFightWorkspaceTab = (value: string): value is FightWorkspaceTab =>
  value === 'chart' || value === 'info'

/** Chart / Player info switcher, shown only below 760px. */
const MobileTabs: FC<MobileTabsProps> = ({ activeTab, onActiveTabChange }) => (
  <Tabs
    className="border-b border-border [grid-area:tabs] min-[760px]:hidden"
    data-region="tabs"
    value={activeTab}
    onValueChange={(value) => {
      if (isFightWorkspaceTab(value)) {
        onActiveTabChange(value)
      }
    }}
  >
    <TabsList aria-label="Fight views" className="px-0">
      <TabsTrigger className="min-h-10 flex-1 text-sm" value="chart">
        Chart
      </TabsTrigger>
      <TabsTrigger className="min-h-10 flex-1 text-sm" value="info">
        Player info
      </TabsTrigger>
    </TabsList>
  </Tabs>
)

/** Lay out the fight page regions; the roster fills the chart row without stretching it. */
export const FightWorkspace: FC<FightWorkspaceProps> = ({
  label = 'Fight workspace',
  chart,
  roster,
  isRosterVisible = true,
  onCloseRoster,
  rosterRef,
  transport,
  drawer,
}) => {
  const [activeTab, setActiveTab] = useState<FightWorkspaceTab>('chart')
  const hasTabs = Boolean(drawer)
  const isInfoTab = hasTabs && activeTab === 'info'
  // Hidden only below 760px; desktop always shows every region.
  const hiddenOnChartTab = activeTab === 'chart' ? 'max-[760px]:hidden' : ''
  const hiddenOnInfoTab = isInfoTab ? 'max-[760px]:hidden' : ''

  return (
    <section
      aria-label={label}
      className={`${workspaceGridClassName} ${isRosterVisible ? rosterVisibleGridClassName : rosterHiddenGridClassName}`}
      data-testid="fight-workspace"
    >
      {hasTabs ? (
        <MobileTabs activeTab={activeTab} onActiveTabChange={setActiveTab} />
      ) : null}
      <div
        className={`flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden surface-canvas px-3 pt-2 pb-1 text-xs/relaxed text-card-foreground [grid-area:chart] max-[760px]:px-1 ${hiddenOnInfoTab}`}
        data-region="chart"
      >
        {chart}
      </div>
      {isRosterVisible && onCloseRoster ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/50 min-[760px]:hidden"
          data-testid="roster-scrim"
          onClick={onCloseRoster}
        />
      ) : null}
      <div
        className={`relative min-h-0 min-w-0 border-t border-border [grid-area:roster] lg:border-t-0 lg:border-l ${mobileRosterClassName} ${isRosterVisible ? '' : 'hidden'}`}
        data-region="roster"
      >
        <div
          className="flex flex-col lg:absolute lg:inset-0 max-[760px]:h-full max-[760px]:overflow-y-auto"
          ref={rosterRef}
        >
          {roster}
        </div>
      </div>
      {transport ? (
        <div
          className={`min-w-0 surface-canvas [grid-area:transport] max-[760px]:border-t max-[760px]:border-border ${hiddenOnInfoTab}`}
          data-region="transport"
        >
          {transport}
        </div>
      ) : null}
      {drawer ? (
        <div
          className={`min-w-0 border-t border-border [grid-area:drawer] max-[760px]:border-t-0 max-[760px]:flex max-[760px]:min-h-0 max-[760px]:flex-col max-[760px]:[grid-area:chart] ${hiddenOnChartTab}`}
          data-region="drawer"
        >
          {drawer}
        </div>
      ) : null}
    </section>
  )
}
