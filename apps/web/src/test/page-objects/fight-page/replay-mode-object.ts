/**
 * Page object for playhead (T) and playback interactions on the fight page.
 */
import { type Locator, type Page } from '@playwright/test'

export class ReplayModeObject {
  constructor(private readonly page: Page) {}

  transport(): Locator {
    return this.page.getByRole('group', { name: 'Playback controls' })
  }

  clearButton(): Locator {
    return this.transport().getByRole('button', { name: /^Clear/ })
  }

  cursorReadout(): Locator {
    return this.transport().getByTestId('transport-cursor')
  }

  playPauseButton(): Locator {
    return this.page.getByRole('button', { name: /^(Play|Pause)$/ }).first()
  }

  /** Roster panel; its header shows the playhead time or "End of fight". */
  threatMeter(): Locator {
    return this.page.getByTestId('threat-meter')
  }

  async togglePlayPauseWithKey(): Promise<void> {
    await this.page.keyboard.press('Space')
  }

  async pressEscape(): Promise<void> {
    await this.page.keyboard.press('Escape')
  }
}
