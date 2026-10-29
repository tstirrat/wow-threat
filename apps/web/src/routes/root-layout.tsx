/**
 * Shared app shell for all routed pages.
 */
import { useAuth } from '@/auth/auth-provider'
import { AppBar } from '@/components/app-bar'
import { AppRail } from '@/components/app-rail'
import { ErrorBoundary } from '@/components/error-boundary'
import { FightPageKeyboardShortcutsOverlay } from '@/components/fight-page-keyboard-shortcuts-overlay'
import { RailLibrary } from '@/components/rail-library'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { usePageViewTracking } from '@/hooks/use-page-view-tracking'
import { type FC, useState } from 'react'
import { useHotkeys, useHotkeysContext } from 'react-hotkeys-hook'
import { Outlet, useLocation } from 'react-router-dom'

import { ShortcutsOverlayContext } from './app-shell-context'
import { AppShellProvider } from './app-shell-provider'

export const RootLayout: FC = () => {
  usePageViewTracking()
  const [reportErrorMessage, setReportErrorMessage] = useState<string | null>(
    null,
  )
  const [isKeyboardOverlayOpen, setIsKeyboardOverlayOpen] = useState(false)
  const { hotkeys } = useHotkeysContext()
  const location = useLocation()
  const isLandingPage = location.pathname === '/'
  // Report routes draw their own flush panels, so the shell adds no padding around them.
  const isReportRoute = location.pathname.startsWith('/report/')
  // The off-canvas rail stays open only on the route it was opened on, so it closes after picking a fight.
  const [railOpenPathname, setRailOpenPathname] = useState<string | null>(null)
  const isMobileRailOpen = railOpenPathname === location.pathname
  const setIsMobileRailOpen = (isOpen: boolean): void => {
    setRailOpenPathname(isOpen ? location.pathname : null)
  }
  const [isRailExpanded, setIsRailExpanded] = useState(true)
  const { authEnabled, authError } = useAuth()

  useHotkeys(
    'shift+slash',
    (event) => {
      event.preventDefault()
      setIsKeyboardOverlayOpen((isOpen) => !isOpen)
    },
    {
      description: 'Toggle shortcuts panel',
      enableOnFormTags: true,
      metadata: {
        order: 70,
        showInFightOverlay: true,
      },
    },
  )

  useHotkeys(
    'escape',
    (event) => {
      event.preventDefault()
      setIsKeyboardOverlayOpen(false)
    },
    {
      enableOnFormTags: true,
      enabled: isKeyboardOverlayOpen,
    },
    [isKeyboardOverlayOpen],
  )

  const closeKeyboardOverlay = (): void => {
    setIsKeyboardOverlayOpen(false)
  }
  const shortcutsOverlay = {
    openShortcuts: () => setIsKeyboardOverlayOpen(true),
  }

  return (
    <AppShellProvider>
      <ShortcutsOverlayContext.Provider value={shortcutsOverlay}>
        <div className="grid h-screen grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] text-foreground max-[760px]:h-dvh max-[760px]:grid-cols-[minmax(0,1fr)]">
          <FightPageKeyboardShortcutsOverlay
            hotkeys={hotkeys}
            isOpen={isKeyboardOverlayOpen}
            onClose={closeKeyboardOverlay}
          />
          <div className="row-span-2 flex min-h-0 max-[760px]:hidden">
            <AppRail
              isOpen={isRailExpanded}
              onOpenChange={setIsRailExpanded}
              isMobileOpen={isMobileRailOpen}
              librarySection={<RailLibrary />}
              onMobileOpenChange={setIsMobileRailOpen}
            />
          </div>
          <AppBar
            isLandingPage={isLandingPage}
            isRailCollapsed={!isRailExpanded}
            isRailOpen={isMobileRailOpen}
            onOpenRail={() => setIsMobileRailOpen(true)}
            onReportError={setReportErrorMessage}
          />
          <main
            className={`min-h-0 overflow-y-auto ${
              isLandingPage
                ? 'mx-auto w-full max-w-7xl px-4 py-6'
                : isReportRoute
                  ? ''
                  : 'p-4 max-[760px]:p-2'
            }`}
          >
            {reportErrorMessage ? (
              <Alert aria-live="polite" className="mb-4" variant="destructive">
                <AlertDescription>{reportErrorMessage}</AlertDescription>
              </Alert>
            ) : null}
            {authEnabled && authError ? (
              <Alert
                aria-live="assertive"
                className="mb-4"
                variant="destructive"
              >
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            ) : null}
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </ShortcutsOverlayContext.Provider>
    </AppShellProvider>
  )
}
