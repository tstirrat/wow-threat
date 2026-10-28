/**
 * Provider holding app shell slot state.
 */
import { type FC, type ReactNode, useMemo, useState } from 'react'

import { AppShellContext, AppShellSettersContext } from './app-shell-context'

/** Provides slot state to the shell and the pages rendered inside it. */
export const AppShellProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [barTitle, setBarTitle] = useState<ReactNode>(null)
  const [barTitleTrailing, setBarTitleTrailing] = useState<ReactNode>(null)
  const [barSettings, setBarSettings] = useState<ReactNode>(null)
  const [barRosterToggle, setBarRosterToggle] = useState<ReactNode>(null)
  const [railReportSection, setRailReportSection] = useState<ReactNode>(null)
  const setters = useMemo(
    () => ({
      setBarTitle,
      setBarTitleTrailing,
      setBarSettings,
      setBarRosterToggle,
      setRailReportSection,
    }),
    [],
  )
  const value = useMemo(
    () => ({
      barTitle,
      barTitleTrailing,
      barSettings,
      barRosterToggle,
      railReportSection,
      ...setters,
    }),
    [
      barTitle,
      barTitleTrailing,
      barSettings,
      barRosterToggle,
      railReportSection,
      setters,
    ],
  )

  return (
    <AppShellSettersContext.Provider value={setters}>
      <AppShellContext.Provider value={value}>
        {children}
      </AppShellContext.Provider>
    </AppShellSettersContext.Provider>
  )
}
