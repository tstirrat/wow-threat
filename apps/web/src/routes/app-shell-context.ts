/**
 * Slot context letting routed pages fill the app bar title and the rail report section.
 */
import { type ReactNode, createContext, useContext, useEffect } from 'react'

export interface AppShellSlots {
  setBarTitle: (node: ReactNode) => void
  setRailReportSection: (node: ReactNode) => void
}

export interface AppShellContextValue extends AppShellSlots {
  barTitle: ReactNode
  railReportSection: ReactNode
}

const noop = (): void => undefined

export const AppShellContext = createContext<AppShellContextValue>({
  barTitle: null,
  railReportSection: null,
  setBarTitle: noop,
  setRailReportSection: noop,
})

/** Stable setters only, so slot fillers do not re-render when slot content changes. */
export const AppShellSettersContext = createContext<AppShellSlots>({
  setBarTitle: noop,
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

/** Fills the rail report section while the calling component is mounted. */
export function useRailReportSection(node: ReactNode): void {
  const { setRailReportSection } = useContext(AppShellSettersContext)

  useEffect(() => {
    setRailReportSection(node)
    return () => setRailReportSection(null)
  }, [node, setRailReportSection])
}
