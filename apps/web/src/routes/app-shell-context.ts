/**
 * Slot context letting routed pages fill the app bar title, bar settings and roster toggle, and the rail report section.
 */
import { type ReactNode, createContext, useContext, useEffect } from 'react'

export interface AppShellSlots {
  setBarTitle: (node: ReactNode) => void
  setBarTitleTrailing: (node: ReactNode) => void
  setBarSettings: (node: ReactNode) => void
  setBarRosterToggle: (node: ReactNode) => void
  setRailReportSection: (node: ReactNode) => void
}

export interface AppShellContextValue extends AppShellSlots {
  barTitle: ReactNode
  barTitleTrailing: ReactNode
  barSettings: ReactNode
  barRosterToggle: ReactNode
  railReportSection: ReactNode
}

const noop = (): void => undefined

export const AppShellContext = createContext<AppShellContextValue>({
  barTitle: null,
  barTitleTrailing: null,
  barSettings: null,
  barRosterToggle: null,
  railReportSection: null,
  setBarTitle: noop,
  setBarTitleTrailing: noop,
  setBarSettings: noop,
  setBarRosterToggle: noop,
  setRailReportSection: noop,
})

/** Stable setters only, so slot fillers do not re-render when slot content changes. */
export const AppShellSettersContext = createContext<AppShellSlots>({
  setBarTitle: noop,
  setBarTitleTrailing: noop,
  setBarSettings: noop,
  setBarRosterToggle: noop,
  setRailReportSection: noop,
})

/** Reads the current slot contents and setters. */
export function useAppShell(): AppShellContextValue {
  return useContext(AppShellContext)
}

/** Fills the app bar title slot while the calling component is mounted. */
export function useBarTitle(node: ReactNode): void {
  const { setBarTitle } = useContext(AppShellSettersContext)

  useEffect(() => {
    setBarTitle(node)
    return () => setBarTitle(null)
  }, [node, setBarTitle])
}

/** Fills the crumb after the app bar title (e.g. the fight target picker) while mounted. */
export function useBarTitleTrailing(node: ReactNode): void {
  const { setBarTitleTrailing } = useContext(AppShellSettersContext)

  useEffect(() => {
    setBarTitleTrailing(node)
    return () => setBarTitleTrailing(null)
  }, [node, setBarTitleTrailing])
}

/** Fills the rail report section while the calling component is mounted. */
export function useRailReportSection(node: ReactNode): void {
  const { setRailReportSection } = useContext(AppShellSettersContext)

  useEffect(() => {
    setRailReportSection(node)
    return () => setRailReportSection(null)
  }, [node, setRailReportSection])
}

/** Fills the app bar settings slot while the calling component is mounted. */
export function useBarSettings(node: ReactNode): void {
  const { setBarSettings } = useContext(AppShellSettersContext)

  useEffect(() => {
    setBarSettings(node)
    return () => setBarSettings(null)
  }, [node, setBarSettings])
}

/** Fills the app bar roster-toggle slot while the calling component is mounted. */
export function useBarRosterToggle(node: ReactNode): void {
  const { setBarRosterToggle } = useContext(AppShellSettersContext)

  useEffect(() => {
    setBarRosterToggle(node)
    return () => setBarRosterToggle(null)
  }, [node, setBarRosterToggle])
}
