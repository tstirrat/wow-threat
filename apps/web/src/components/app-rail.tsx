/**
 * Collapsible left rail: "This report" and "Library" tabs on report routes, Library alone elsewhere. Open on every page load.
 * Footer pinned to the bottom holds the account control and theme toggle.
 * Below 760px it becomes an off-canvas sheet from the left, opened from the app bar's Menu button.
 */
import { ChevronsLeft, ChevronsRight, FileText, Library } from 'lucide-react'
import { type FC, type ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useIsMobileLayout } from '../hooks/use-is-mobile-layout'
import { useAppShell } from '../routes/app-shell-context'
import { RailAccount } from './rail-account'
import { Button } from './ui/button'
import { Sheet, SheetContent, SheetTitle } from './ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

export interface AppRailProps {
  librarySection?: ReactNode
  isMobileOpen?: boolean
  onMobileOpenChange?: (isOpen: boolean) => void
  /** Desktop open state; controlled when provided, otherwise internal (open by default). */
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
}

type RailBodyProps = {
  activeTab: string
  librarySection: ReactNode
  onActiveTabChange: (tab: string) => void
  railReportSection: ReactNode
}

const RailBody: FC<RailBodyProps> = ({
  activeTab,
  librarySection,
  onActiveTabChange,
  railReportSection,
}) =>
  railReportSection ? (
    <Tabs
      className="flex min-h-0 flex-1 flex-col"
      onValueChange={onActiveTabChange}
      value={activeTab}
    >
      <TabsList aria-label="Sidebar sections" className="h-9 shrink-0">
        <TabsTrigger
          className="inline-flex items-center gap-1.5 whitespace-nowrap max-[760px]:min-h-10"
          value="report"
        >
          <FileText aria-hidden="true" className="size-3.5" />
          This report
        </TabsTrigger>
        <TabsTrigger
          className="inline-flex items-center gap-1.5 whitespace-nowrap max-[760px]:min-h-10"
          value="library"
        >
          <Library aria-hidden="true" className="size-3.5" />
          Library
        </TabsTrigger>
      </TabsList>
      <TabsContent
        className="min-h-0 flex-1 overflow-y-auto"
        data-testid="app-rail-report-section"
        forceMount
        hidden={activeTab !== 'report'}
        value="report"
      >
        {railReportSection}
      </TabsContent>
      <TabsContent
        className="min-h-0 flex-1 overflow-y-auto"
        data-testid="app-rail-library-section"
        forceMount
        hidden={activeTab !== 'library'}
        value="library"
      >
        {librarySection}
      </TabsContent>
    </Tabs>
  ) : (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      data-testid="app-rail-library-section"
    >
      <h2 className="flex items-center gap-1.5 border-b border-border px-4 py-1.5 text-xs font-medium">
        <Library aria-hidden="true" className="size-3.5" />
        Library
      </h2>
      {librarySection}
    </div>
  )

type CollapsedRailTabsProps = {
  hasReport: boolean
  onSelect: (tab: string) => void
}

/** Icon-only stand-ins for the rail sections; selecting one expands the rail on that tab. */
const CollapsedRailTabs: FC<CollapsedRailTabsProps> = ({
  hasReport,
  onSelect,
}) => (
  <TooltipProvider delayDuration={0}>
    <div
      className="flex min-h-0 flex-1 flex-col items-center gap-1 py-2"
      data-testid="app-rail-collapsed-tabs"
    >
      {hasReport ? (
        <CollapsedRailTab
          icon={<FileText aria-hidden="true" />}
          label="This report"
          onClick={() => onSelect('report')}
        />
      ) : null}
      <CollapsedRailTab
        icon={<Library aria-hidden="true" />}
        label="Library"
        onClick={() => onSelect('library')}
      />
    </div>
  </TooltipProvider>
)

type CollapsedRailTabProps = {
  icon: ReactNode
  label: string
  onClick: () => void
}

/** Icon button with a right-hand tooltip naming the section. */
const CollapsedRailTab: FC<CollapsedRailTabProps> = ({
  icon,
  label,
  onClick,
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        aria-label={label}
        size="icon"
        type="button"
        variant="ghost"
        onClick={onClick}
      >
        {icon}
      </Button>
    </TooltipTrigger>
    <TooltipContent side="right" withArrow>
      {label}
    </TooltipContent>
  </Tooltip>
)

export const AppRail: FC<AppRailProps> = ({
  librarySection = null,
  isMobileOpen = false,
  onMobileOpenChange,
  isOpen: controlledIsOpen,
  onOpenChange,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(true)
  const isOpen = controlledIsOpen ?? internalIsOpen
  const setIsOpen = (nextOpen: boolean): void => {
    setInternalIsOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }
  const [activeTab, setActiveTab] = useState('report')
  // Picking something from the library navigates; land back on "This report".
  const { pathname } = useLocation()
  const [lastPathname, setLastPathname] = useState(pathname)
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setActiveTab('report')
  }
  const { railReportSection } = useAppShell()
  const isMobile = useIsMobileLayout()
  const body = (
    <RailBody
      activeTab={activeTab}
      librarySection={librarySection}
      onActiveTabChange={setActiveTab}
      railReportSection={railReportSection}
    />
  )

  if (isMobile) {
    return (
      <Sheet open={isMobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          aria-describedby={undefined}
          className="w-[min(320px,88vw)] surface-chrome"
          closeLabel="Close sidebar"
          side="left"
          withOverlay
          onOpenAutoFocus={(event) => {
            // Focusing the footer's tooltip trigger opens its tooltip, which swallows the first Escape.
            event.preventDefault()
            if (event.currentTarget instanceof HTMLElement) {
              event.currentTarget.focus()
            }
          }}
        >
          <SheetTitle className="sr-only">Sidebar</SheetTitle>
          <aside
            aria-label="Sidebar"
            className="flex min-h-0 flex-1 flex-col pt-12"
            data-state="open"
            data-testid="app-rail"
          >
            {body}
            <RailAccount />
          </aside>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside
      aria-label="Sidebar"
      className={`flex h-full min-h-0 shrink-0 flex-col border-r border-border surface-chrome transition-[width] duration-200 ${
        isOpen ? 'w-64' : 'w-12'
      }`}
      data-state={isOpen ? 'open' : 'closed'}
      data-testid="app-rail"
    >
      {/* box-content + h-11 + border-b matches the app bar's 44px row and hairline. */}
      <div
        className={`box-content flex h-11 shrink-0 items-center border-b border-border px-2 ${
          isOpen ? 'justify-between' : 'justify-center'
        }`}
      >
        {isOpen ? (
          <Link
            className="truncate px-1 text-sm font-semibold tracking-tight"
            to="/"
          >
            WOW Threat
          </Link>
        ) : null}
        <Button
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          size="icon"
          type="button"
          variant="ghost"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <ChevronsLeft aria-hidden="true" />
          ) : (
            <ChevronsRight aria-hidden="true" />
          )}
        </Button>
      </div>
      {isOpen ? (
        body
      ) : (
        <CollapsedRailTabs
          hasReport={Boolean(railReportSection)}
          onSelect={(tab) => {
            setActiveTab(tab)
            setIsOpen(true)
          }}
        />
      )}
      <RailAccount collapsed={!isOpen} />
    </aside>
  )
}
