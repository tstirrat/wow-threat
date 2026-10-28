/**
 * Keyboard shortcuts overlay for fight-page interactions.
 */
import { useMemo } from 'react'
import type { Hotkey } from 'react-hotkeys-hook'

import { superKey } from '../lib/keyboard-shortcut'
import { Kbd, KbdGroup } from './ui/kbd'

interface FightPageKeyboardShortcut {
  description: string
  group: string
  hotkey: string
  order: number
}

const DEFAULT_GROUP = 'Chart'

interface ShortcutMetadata {
  group?: string
  order?: number
  showInFightOverlay?: boolean
}

export interface FightPageKeyboardShortcutsOverlayProps {
  hotkeys: readonly Hotkey[]
  isOpen: boolean
  onClose: () => void
}

function formatHotkeyPart(part: string, isShifted: boolean): string {
  const normalized = part.trim().toLowerCase()
  if (normalized.length === 0) {
    return ''
  }

  if (normalized === 'mod') {
    return superKey()
  }

  if (normalized === 'meta') {
    return superKey()
  }

  if (normalized === 'ctrl' || normalized === 'control') {
    return 'Ctrl'
  }

  if (normalized === 'esc' || normalized === 'escape') {
    return 'Esc'
  }

  if (normalized === 'arrowup') {
    return 'Up'
  }

  if (normalized === 'arrowdown') {
    return 'Down'
  }

  if (normalized === 'arrowleft') {
    return 'Left'
  }

  if (normalized === 'arrowright') {
    return 'Right'
  }

  if (normalized === 'slash') {
    return '/'
  }

  if (normalized === 'period') {
    return isShifted ? '>' : '.'
  }

  if (normalized === 'comma') {
    return isShifted ? '<' : ','
  }

  if (normalized.length === 1) {
    return normalized.toUpperCase()
  }

  return `${normalized[0]?.toUpperCase() ?? ''}${normalized.slice(1)}`
}

function renderHotkey(hotkey: string): JSX.Element {
  const alternatives = hotkey
    .split(',')
    .map((combo) => {
      const parts = combo.split('+')
      const isShifted = parts.some(
        (part) => part.trim().toLowerCase() === 'shift',
      )

      return parts
        .map((part) => formatHotkeyPart(part, isShifted))
        .filter((part) => part.length > 0)
    })
    .filter((combo) => combo.length > 0)

  return (
    <span className="inline-flex items-center gap-2">
      {alternatives.map((combo, comboIndex) => (
        <span
          className="inline-flex items-center gap-2"
          key={`${hotkey}-${comboIndex}`}
        >
          {comboIndex > 0 ? (
            <span className="text-muted-foreground">or</span>
          ) : null}
          {combo.length === 1 ? (
            <Kbd>{combo[0]}</Kbd>
          ) : (
            <KbdGroup>
              {combo.map((part, partIndex) => (
                <span
                  className="inline-flex items-center gap-2"
                  key={`${part}-${partIndex}`}
                >
                  {partIndex > 0 ? <span>+</span> : null}
                  <Kbd>{part}</Kbd>
                </span>
              ))}
            </KbdGroup>
          )}
        </span>
      ))}
    </span>
  )
}

/** Render keyboard shortcuts help overlay for the fight page. */
export function FightPageKeyboardShortcutsOverlay({
  hotkeys,
  isOpen,
  onClose,
}: FightPageKeyboardShortcutsOverlayProps) {
  const shortcuts = useMemo(() => {
    const shortcutMap = hotkeys.reduce<Map<string, FightPageKeyboardShortcut>>(
      (accumulator, hotkey) => {
        const metadata = (hotkey.metadata ?? {}) as ShortcutMetadata
        if (!hotkey.description || metadata.showInFightOverlay !== true) {
          return accumulator
        }

        const shortcut = {
          description: hotkey.description,
          group: metadata.group ?? DEFAULT_GROUP,
          hotkey: hotkey.hotkey,
          order: metadata.order ?? Number.MAX_SAFE_INTEGER,
        }
        const shortcutKey = `${shortcut.description}::${shortcut.hotkey}`
        if (!accumulator.has(shortcutKey)) {
          accumulator.set(shortcutKey, shortcut)
        }

        return accumulator
      },
      new Map<string, FightPageKeyboardShortcut>(),
    )

    const groupMap = new Map<string, FightPageKeyboardShortcut[]>()
    for (const shortcut of shortcutMap.values()) {
      const existing = groupMap.get(shortcut.group)
      if (existing) {
        existing.push(shortcut)
      } else {
        groupMap.set(shortcut.group, [shortcut])
      }
    }

    const sortItems = (items: FightPageKeyboardShortcut[]) =>
      items.sort((left, right) => {
        if (left.order !== right.order) {
          return left.order - right.order
        }

        if (left.description !== right.description) {
          return left.description.localeCompare(right.description)
        }

        return left.hotkey.localeCompare(right.hotkey)
      })

    return [...groupMap.entries()].map(([name, items]) => ({
      name,
      items: sortItems(items),
    }))
  }, [hotkeys])

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
        <div className="space-y-3 text-sm">
          {shortcuts.map((group, groupIndex) => (
            <div key={`${group.name}-${groupIndex}`}>
              <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
                {group.name}
              </h3>
              <ul className="space-y-2">
                {group.items.map((shortcut) => (
                  <li
                    className="flex items-center justify-between gap-3"
                    key={`${shortcut.description}-${shortcut.hotkey}`}
                  >
                    <span>{shortcut.description}</span>
                    {renderHotkey(shortcut.hotkey)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
