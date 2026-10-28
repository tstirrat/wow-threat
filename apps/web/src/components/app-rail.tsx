/**
 * Collapsible left rail: "This report" and "Library" tabs on report routes, Library alone elsewhere. Open on every page load.
 */
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { type FC, type ReactNode, useState } from 'react'

import { useAppShell } from '../routes/app-shell-context'
import { Button } from './ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

export interface AppRailProps {
  librarySection?: ReactNode
}

export const AppRail: FC<AppRailProps> = ({ librarySection = null }) => {
  const [isOpen, setIsOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('report')
  const { railReportSection } = useAppShell()

  return (
    <aside
      aria-label="Sidebar"
      className={`flex shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ${
        isOpen ? 'w-64' : 'w-12'
      }`}
      data-state={isOpen ? 'open' : 'closed'}
      data-testid="app-rail"
    >
      <div className={`flex p-2 ${isOpen ? 'justify-end' : 'justify-center'}`}>
        <Button
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          size="icon"
          type="button"
          variant="ghost"
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? (
            <ChevronsLeft aria-hidden="true" />
          ) : (
            <ChevronsRight aria-hidden="true" />
          )}
        </Button>
      </div>
      {isOpen ? (
        railReportSection ? (
          <Tabs
            className="flex min-h-0 flex-1 flex-col"
            onValueChange={setActiveTab}
            value={activeTab}
          >
            <TabsList aria-label="Sidebar sections">
              <TabsTrigger value="report">This report</TabsTrigger>
              <TabsTrigger value="library">Library</TabsTrigger>
            </TabsList>
            <TabsContent
              data-testid="app-rail-report-section"
              forceMount
              hidden={activeTab !== 'report'}
              value="report"
            >
              {railReportSection}
            </TabsContent>
            <TabsContent
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
            <h2 className="border-b border-border px-4 py-1.5 text-xs font-medium">
              Library
            </h2>
            {librarySection}
          </div>
        )
      ) : null}
    </aside>
  )
}
