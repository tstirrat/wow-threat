/**
 * Page object for the app shell chrome: app bar buttons and the (off-canvas on mobile) rail.
 */
import { type Locator, type Page } from '@playwright/test'

export class AppShellObject {
  readonly bar: Locator
  readonly rail: Locator

  constructor(private readonly page: Page) {
    this.bar = page.getByTestId('app-bar')
    this.rail = page.getByTestId('app-rail')
  }

  menuButton(): Locator {
    return this.bar.getByRole('button', { name: 'Open sidebar' })
  }

  closeRailButton(): Locator {
    return this.page.getByRole('button', { name: 'Close sidebar' })
  }

  barButtons(): Locator {
    return this.bar.locator('button:visible')
  }

  async openRail(): Promise<void> {
    await this.menuButton().click()
  }

  /** Tap the scrim to the right of the off-canvas rail. */
  async closeRailWithScrim(): Promise<void> {
    const viewport = this.page.viewportSize()
    await this.page
      .locator('[data-slot="sheet-overlay"]')
      .click({ position: { x: (viewport?.width ?? 375) - 8, y: 400 } })
  }

  /** Document width minus viewport width; positive means horizontal page scroll. */
  async horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
  }
}
