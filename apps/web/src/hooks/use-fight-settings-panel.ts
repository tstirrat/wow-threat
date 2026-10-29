/**
 * Open state, gear-button focus return and the "," hotkey for the fight settings panel.
 */
import { type RefObject, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

export interface FightSettingsPanelState {
  isOpen: boolean
  setOpen: (isOpen: boolean) => void
  triggerRef: RefObject<HTMLButtonElement | null>
}

/** Tracks whether the settings panel is open and opens it on the comma key. */
export function useFightSettingsPanel(
  onOpen?: () => void,
): FightSettingsPanelState {
  const [isOpen, setIsOpen] = useState(false)
  const setOpen = (nextIsOpen: boolean): void => {
    if (nextIsOpen) {
      onOpen?.()
    }
    setIsOpen(nextIsOpen)
  }
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useHotkeys(
    'comma',
    (event) => {
      event.preventDefault()
      setOpen(true)
    },
    {
      description: 'Open settings',
      metadata: { order: 12, showInFightOverlay: true },
      scopes: ['fight-page'],
    },
  )

  return { isOpen, setOpen, triggerRef }
}
