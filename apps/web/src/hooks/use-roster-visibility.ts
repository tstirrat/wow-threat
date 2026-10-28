/**
 * Roster panel visibility state persisted in local storage, with the R hotkey.
 */
import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { rosterHiddenStorageKey } from '../lib/constants'

export type RosterVisibility = {
  isRosterVisible: boolean
  toggleRoster: () => void
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

/** Track whether the roster panel is shown; persists the choice and binds R. */
export function useRosterVisibility(): RosterVisibility {
  const [isRosterVisible, setIsRosterVisible] = useState(loadRosterVisible)

  const toggleRoster = (): void => {
    const next = !isRosterVisible
    saveRosterVisible(next)
    setIsRosterVisible(next)
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
    [isRosterVisible],
  )

  return { isRosterVisible, toggleRoster }
}
