/**
 * Keyboard shortcuts overlay for fight-page interactions.
 */
import { superKey } from '../lib/keyboard-shortcut'
import { Kbd, KbdGroup } from './ui/kbd'

export interface FightPageKeyboardShortcutsOverlayProps {
  isOpen: boolean
  onClose: () => void
}

/** Render keyboard shortcuts help overlay for the fight page. */
export function FightPageKeyboardShortcutsOverlay({
  isOpen,
  onClose,
}: FightPageKeyboardShortcutsOverlayProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      aria-label="Keyboard shortcuts"
      aria-modal="false"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      onClick={() => {
        onClose()
      }}
    >
      <div
        className="h-fit w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg"
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
          <KbdGroup>
            <Kbd>Esc</Kbd>
          </KbdGroup>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between gap-3">
            <span>Toggle show boss damage</span>
            <Kbd>B</Kbd>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Toggle show pets</span>
            <Kbd>P</Kbd>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Toggle show energize events</span>
            <Kbd>E</Kbd>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Clear isolate</span>
            <Kbd>C</Kbd>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Isolate focused player</span>
            <Kbd>I</Kbd>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Open player search</span>
            <Kbd>/</Kbd>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Search: add + focus player</span>
            <KbdGroup>
              <Kbd>Shift</Kbd>
              <span>+</span>
              <Kbd>Enter</Kbd>
            </KbdGroup>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Toggle shortcuts panel</span>
            <KbdGroup>
              <Kbd>Shift</Kbd>
              <span>+</span>
              <Kbd>/</Kbd>
            </KbdGroup>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Open report input</span>
            <KbdGroup>
              <Kbd>{superKey()}</Kbd>
              <span>+</span>
              <Kbd>O</Kbd>
            </KbdGroup>
          </li>
        </ul>
      </div>
    </div>
  )
}
