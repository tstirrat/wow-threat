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
        <div className="grid h-screen grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] text-foreground">
          <FightPageKeyboardShortcutsOverlay
            hotkeys={hotkeys}
            isOpen={isKeyboardOverlayOpen}
            onClose={closeKeyboardOverlay}
          />
          <div className="row-span-2">
            <AppRail librarySection={<RailLibrary />} />
          </div>
          <AppBar
            isLandingPage={isLandingPage}
            onReportError={setReportErrorMessage}
          />
          <main
            className={`min-h-0 overflow-y-auto ${
              isLandingPage ? 'mx-auto w-full max-w-7xl px-4 py-6' : 'p-4'
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
