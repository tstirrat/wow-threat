/**
 * Unit tests for the fight settings panel, its gear button and the comma hotkey.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type FC, createRef } from 'react'
import { HotkeysProvider } from 'react-hotkeys-hook'
import { describe, expect, it, vi } from 'vitest'

import { useFightSettingsPanel } from '../hooks/use-fight-settings-panel'
import {
  FightSettingsButton,
  FightSettingsPanel,
  type FightSettingsPanelProps,
} from './fight-settings-panel'

function createProps(
  overrides: Partial<FightSettingsPanelProps> = {},
): FightSettingsPanelProps {
  return {
    isOpen: true,
    onOpenChange: vi.fn(),
    triggerRef: createRef<HTMLButtonElement>(),
    showFixateBands: true,
    onShowFixateBandsChange: vi.fn(),
    showEnergizeEvents: false,
    onShowEnergizeEventsChange: vi.fn(),
    showPets: false,
    onShowPetsChange: vi.fn(),
    bossDamageMode: 'melee',
    onBossDamageModeChange: vi.fn(),
    inferThreatReduction: false,
    onInferThreatReductionChange: vi.fn(),
    ...overrides,
  }
}

const Harness: FC = () => {
  const panel = useFightSettingsPanel()

  return (
    <>
      <FightSettingsButton
        triggerRef={panel.triggerRef}
        onOpen={() => {
          panel.setOpen(true)
        }}
      />
      <FightSettingsPanel
        {...createProps({
          isOpen: panel.isOpen,
          onOpenChange: panel.setOpen,
          triggerRef: panel.triggerRef,
        })}
      />
    </>
  )
}

function renderHarness() {
  return render(
    <HotkeysProvider initiallyActiveScopes={['fight-page']}>
      <Harness />
    </HotkeysProvider>,
  )
}

describe('FightSettingsPanel', () => {
  it('groups settings and shows the boss damage hotkey', () => {
    render(<FightSettingsPanel {...createProps()} />)

    expect(screen.getByText('My display')).toBeInTheDocument()
    expect(screen.getByText('This analysis')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it.each([
    ['Show fixate areas', 'onShowFixateBandsChange', false],
    ['Show energize events', 'onShowEnergizeEventsChange', true],
    ['Show pets', 'onShowPetsChange', true],
    ['Infer common threat buffs', 'onInferThreatReductionChange', true],
  ] as const)('emits changes for %s', async (name, handler, expected) => {
    const props = createProps()
    render(<FightSettingsPanel {...props} />)

    await userEvent.click(screen.getByRole('checkbox', { name }))

    expect(props[handler]).toHaveBeenCalledWith(expected)
  })

  it('emits boss damage mode changes', async () => {
    const props = createProps()
    render(<FightSettingsPanel {...props} />)

    await userEvent.click(
      screen.getByRole('radio', { name: 'Boss damage all' }),
    )

    expect(props.onBossDamageModeChange).toHaveBeenCalledWith('all')
  })

  it('opens from the gear button, moves focus in, and returns focus on Escape', async () => {
    renderHarness()
    expect(screen.queryByRole('dialog')).toBeNull()

    const gear = screen.getByRole('button', { name: 'Settings' })
    await userEvent.click(gear)

    const dialog = await screen.findByRole('dialog', { name: 'Settings' })
    expect(dialog.contains(document.activeElement)).toBe(true)

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(gear).toHaveFocus()
  })

  it('opens with the comma key and closes with the X button', async () => {
    renderHarness()

    await userEvent.keyboard('[Comma]')
    expect(
      await screen.findByRole('dialog', { name: 'Settings' }),
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Close settings' }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ignores comma with modifiers', async () => {
    renderHarness()

    await userEvent.keyboard('{Shift>}[Comma]{/Shift}')
    await userEvent.keyboard('{Meta>}[Comma]{/Meta}')

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
