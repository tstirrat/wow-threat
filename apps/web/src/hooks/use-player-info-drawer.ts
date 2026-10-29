/**
 * Player info drawer open state persisted in local storage, with the I hotkey.
 */
import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import {
  playerInfoClosedStorageKey,
  playerInfoHeightStorageKey,
} from '../lib/constants'

export type PlayerInfoDrawer = {
  isPlayerInfoOpen: boolean
  togglePlayerInfo: () => void
  /** Persisted body height in px, or null until the user has resized it. */
  playerInfoHeight: number | null
  setPlayerInfoHeight: (height: number) => void
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

function loadPlayerInfoHeight(): number | null {
  try {
    const stored = Number(
      window.localStorage.getItem(playerInfoHeightStorageKey),
    )
    return Number.isFinite(stored) && stored > 0 ? stored : null
  } catch {
    return null
  }
}

function savePlayerInfoHeight(height: number): void {
  try {
    window.localStorage.setItem(playerInfoHeightStorageKey, String(height))
  } catch {
    // Keep resizing responsive when storage is unavailable.
  }
}

/** Track whether the player info drawer is expanded; persists the choice and binds I. */
export function usePlayerInfoDrawer(): PlayerInfoDrawer {
  const [isPlayerInfoOpen, setIsPlayerInfoOpen] = useState(loadPlayerInfoOpen)

  const [playerInfoHeight, setHeight] = useState(loadPlayerInfoHeight)

  const setPlayerInfoHeight = (height: number): void => {
    savePlayerInfoHeight(height)
    setHeight(height)
  }

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

  return {
    isPlayerInfoOpen,
    togglePlayerInfo,
    playerInfoHeight,
    setPlayerInfoHeight,
  }
}
