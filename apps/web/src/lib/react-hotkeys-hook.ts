/**
 * Local compatibility shim for react-hotkeys-hook while registry access is restricted.
 */
import { useEffect } from 'react'

export interface UseHotkeysOptions {
  enableOnFormTags?: boolean
}

/** Register one or more comma-delimited keyboard shortcuts. */
export function useHotkeys(
  shortcuts: string,
  onHotkey: (event: KeyboardEvent) => void,
  options: UseHotkeysOptions = {},
): void {
  useEffect(() => {
    const hotkeys = shortcuts
      .split(',')
      .map((value) => value.trim().toLowerCase())

    const handleKeyDown = (event: KeyboardEvent): void => {
      const activeElement = document.activeElement
      const isFormField =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement?.getAttribute('contenteditable') === 'true'

      if (isFormField && !options.enableOnFormTags) {
        return
      }

      const currentShortcut = `${event.metaKey ? 'meta+' : ''}${
        event.ctrlKey ? 'ctrl+' : ''
      }${event.key.toLowerCase()}`

      if (!hotkeys.includes(currentShortcut)) {
        return
      }

      onHotkey(event)
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onHotkey, options.enableOnFormTags, shortcuts])
}
