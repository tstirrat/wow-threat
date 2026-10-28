/**
 * Provider holding app shell slot state.
 */
import { type FC, type ReactNode, useMemo, useState } from 'react'

import { AppShellContext, AppShellSettersContext } from './app-shell-context'

/** Provides slot state to the shell and the pages rendered inside it. */
export const AppShellProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [barTitle, setBarTitle] = useState<ReactNode>(null)
  const [railReportSection, setRailReportSection] = useState<ReactNode>(null)
  const setters = useMemo(() => ({ setBarTitle, setRailReportSection }), [])
  const value = useMemo(
    () => ({ barTitle, railReportSection, setBarTitle, setRailReportSection }),
    [barTitle, railReportSection],
  )

  return (
    <AppShellSettersContext.Provider value={setters}>
      <AppShellContext.Provider value={value}>
        {children}
      </AppShellContext.Provider>
    </AppShellSettersContext.Provider>
  )
}
