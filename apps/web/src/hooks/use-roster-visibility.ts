/**
 * Roster panel visibility state with the R hotkey: persisted in local storage on desktop,
 * an off-canvas panel that starts closed (and closes on Esc) below 760px.
 */
import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { rosterHiddenStorageKey } from '../lib/constants'
import { useIsMobileLayout } from './use-is-mobile-layout'

export type RosterVisibility = {
  isRosterVisible: boolean
  toggleRoster: () => void
  closeRoster: () => void
}

function loadRosterVisible(): boolean {
  try {
    return window.localStorage.getItem(rosterHiddenStorageKey) !== 'true'
  } catch {
    return true
  }
}

function saveRosterVisible(isVisible: boolean): void {
  try {
    window.localStorage.setItem(rosterHiddenStorageKey, String(!isVisible))
  } catch {
    // Keep the toggle responsive when storage is unavailable.
  }
}

/** Track whether the roster panel is shown; persists the desktop choice and binds R (and Esc on mobile). */
export function useRosterVisibility(): RosterVisibility {
  const isMobile = useIsMobileLayout()
  const [isDesktopRosterVisible, setIsDesktopRosterVisible] =
    useState(loadRosterVisible)
  const [isMobileRosterOpen, setIsMobileRosterOpen] = useState(false)
  const isRosterVisible = isMobile ? isMobileRosterOpen : isDesktopRosterVisible

  const toggleRoster = (): void => {
    if (isMobile) {
      setIsMobileRosterOpen(!isMobileRosterOpen)
      return
    }
    const next = !isDesktopRosterVisible
    saveRosterVisible(next)
    setIsDesktopRosterVisible(next)
  }

  const closeRoster = (): void => {
    if (isMobile) {
      setIsMobileRosterOpen(false)
    }
  }

  useHotkeys(
    'r',
    (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return
      }
      event.preventDefault()
      toggleRoster()
    },
    {
      description: 'Show / hide roster panel',
      metadata: { order: 20, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
    [isMobile, isDesktopRosterVisible, isMobileRosterOpen],
  )

  useHotkeys(
    'escape',
    () => {
      setIsMobileRosterOpen(false)
    },
    {
      enabled: isMobile && isMobileRosterOpen,
      enableOnFormTags: true,
      scopes: ['fight-page'],
    },
    [isMobile, isMobileRosterOpen],
  )

  return { isRosterVisible, toggleRoster, closeRoster }
}
