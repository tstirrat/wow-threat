/**
 * Page object for replay mode interactions on the fight page.
 */
import { type Locator, type Page } from '@playwright/test'

export class ReplayModeObject {
  constructor(private readonly page: Page) {}

  transport(): Locator {
    return this.page.getByRole('group', { name: 'Playback controls' })
  }

  clearButton(): Locator {
    return this.transport().getByRole('button', { name: 'Clear', exact: true })
  }

  cursorReadout(): Locator {
    return this.transport().getByTestId('transport-cursor')
  }

  replayButton(): Locator {
    return this.page.getByRole('button', { name: 'Replay', exact: true })
  }

  exitReplayButton(): Locator {
    return this.page.getByRole('button', {
      name: 'Exit Replay',
      exact: true,
    })
  }

  playPauseButton(): Locator {
    return this.page.getByRole('button', { name: /^(Play|Pause)$/ }).first()
  }

  threatMeter(): Locator {
    return this.page.getByTestId('threat-meter')
  }

  async togglePlayPauseWithKey(): Promise<void> {
    await this.page.keyboard.press('Space')
  }

  async exitWithEscape(): Promise<void> {
    await this.page.keyboard.press('Escape')
  }
}
