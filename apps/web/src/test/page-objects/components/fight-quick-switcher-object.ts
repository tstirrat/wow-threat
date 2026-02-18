/**
 * Page object for the shared fight quick-switcher component.
 */
import { type Locator, type Page } from '@playwright/test'

export class FightQuickSwitcherObject {
  readonly root: Locator

  constructor(page: Page) {
    this.root = page.getByRole('navigation', { name: 'Fight quick switch' })
  }

  fightLink(name: string): Locator {
    return this.root.getByRole('link', { name, exact: true })
  }

  fightLinks(): Locator {
    return this.root.getByRole('link')
  }

  async clickFight(name: string): Promise<void> {
    await this.fightLink(name).click()
  }

  fightText(name: string): Locator {
    return this.root.getByText(name, { exact: true })
  }
}
