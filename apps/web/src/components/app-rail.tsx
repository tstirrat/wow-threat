/**
 * Collapsible left rail with report and library slots. Open on every page load.
 */
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { type FC, type ReactNode, useState } from 'react'

import { useAppShell } from '../routes/app-shell-context'
import { Button } from './ui/button'

export interface AppRailProps {
  librarySection?: ReactNode
}

export const AppRail: FC<AppRailProps> = ({ librarySection = null }) => {
  const [isOpen, setIsOpen] = useState(true)
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
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div data-testid="app-rail-report-section">{railReportSection}</div>
          <div data-testid="app-rail-library-section">{librarySection}</div>
        </div>
      ) : null}
    </aside>
  )
}
