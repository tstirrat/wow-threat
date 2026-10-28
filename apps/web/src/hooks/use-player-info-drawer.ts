/**
 * Player info drawer open state persisted in local storage, with the I hotkey.
 */
import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { playerInfoClosedStorageKey } from '../lib/constants'

export type PlayerInfoDrawer = {
  isPlayerInfoOpen: boolean
  togglePlayerInfo: () => void
}

function loadPlayerInfoOpen(): boolean {
  try {
    return window.localStorage.getItem(playerInfoClosedStorageKey) !== 'true'
  } catch {
    return true
  }
}

function savePlayerInfoOpen(isOpen: boolean): void {
  try {
    window.localStorage.setItem(playerInfoClosedStorageKey, String(!isOpen))
  } catch {
    // Keep the toggle responsive when storage is unavailable.
  }
}

/** Track whether the player info drawer is expanded; persists the choice and binds I. */
export function usePlayerInfoDrawer(): PlayerInfoDrawer {
  const [isPlayerInfoOpen, setIsPlayerInfoOpen] = useState(loadPlayerInfoOpen)

  const togglePlayerInfo = (): void => {
    const next = !isPlayerInfoOpen
    savePlayerInfoOpen(next)
    setIsPlayerInfoOpen(next)
  }

  useHotkeys(
    'i',
    (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return
      }
      event.preventDefault()
      togglePlayerInfo()
    },
    {
      description: 'Show / hide player info drawer',
      metadata: { order: 21, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
    [isPlayerInfoOpen],
  )

  return { isPlayerInfoOpen, togglePlayerInfo }
}
