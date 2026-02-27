/**
 * Global keyboard shortcuts for threat-chart toggles and overlay visibility.
 */
import { useCallback, useEffect, useState } from 'react'

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const tag = target.tagName
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
}

function isShortcutsOverlayToggleKey(event: KeyboardEvent): boolean {
  return event.key === '?' || (event.shiftKey && event.key === '/')
}

export interface UseThreatChartKeyboardShortcutsResult {
  isKeyboardOverlayOpen: boolean
  closeKeyboardOverlay: () => void
}

/** Wire global keydown handlers for chart display toggles and helper overlays. */
export function useThreatChartKeyboardShortcuts({
  showBossMelee,
  onShowBossMeleeChange,
  showPets,
  onShowPetsChange,
  showEnergizeEvents,
  onShowEnergizeEventsChange,
  canClearIsolate,
  onClearIsolate,
  openPlayerSearch,
  closePlayerSearch,
  isolateFocusedPlayer,
}: {
  showBossMelee: boolean
  onShowBossMeleeChange: (showBossMelee: boolean) => void
  showPets: boolean
  onShowPetsChange: (showPets: boolean) => void
  showEnergizeEvents: boolean
  onShowEnergizeEventsChange: (showEnergizeEvents: boolean) => void
  canClearIsolate: boolean
  onClearIsolate: () => void
  openPlayerSearch: () => void
  closePlayerSearch: () => void
  isolateFocusedPlayer: () => void
}): UseThreatChartKeyboardShortcutsResult {
  const [isKeyboardOverlayOpen, setIsKeyboardOverlayOpen] = useState(false)

  const closeKeyboardOverlay = useCallback((): void => {
    setIsKeyboardOverlayOpen(false)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (isEditableShortcutTarget(event.target)) {
        return
      }

      if (event.key === '/' && !event.shiftKey) {
        event.preventDefault()
        closeKeyboardOverlay()
        openPlayerSearch()
        return
      }

      if (isShortcutsOverlayToggleKey(event)) {
        event.preventDefault()
        closePlayerSearch()
        setIsKeyboardOverlayOpen((isOpen) => !isOpen)
        return
      }

      if (event.key === 'Escape') {
        closePlayerSearch()
        closeKeyboardOverlay()
        return
      }

      switch (event.key.toLowerCase()) {
        case 'b':
          event.preventDefault()
          onShowBossMeleeChange(!showBossMelee)
          break
        case 'p':
          event.preventDefault()
          onShowPetsChange(!showPets)
          break
        case 'e':
          event.preventDefault()
          onShowEnergizeEventsChange(!showEnergizeEvents)
          break
        case 'c':
          if (canClearIsolate) {
            event.preventDefault()
            onClearIsolate()
          }
          break
        case 'i':
          event.preventDefault()
          isolateFocusedPlayer()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    canClearIsolate,
    closeKeyboardOverlay,
    closePlayerSearch,
    isolateFocusedPlayer,
    onClearIsolate,
    onShowBossMeleeChange,
    onShowEnergizeEventsChange,
    onShowPetsChange,
    openPlayerSearch,
    showBossMelee,
    showEnergizeEvents,
    showPets,
  ])

  return {
    isKeyboardOverlayOpen,
    closeKeyboardOverlay,
  }
}
