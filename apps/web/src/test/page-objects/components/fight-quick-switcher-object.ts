/**
 * Page object for the rail pull list (fight quick switch) in the report outline.
 */
import { type Locator, type Page } from '@playwright/test'

export class FightQuickSwitcherObject {
  readonly root: Locator

  constructor(page: Page) {
    this.root = page
      .getByTestId('app-rail')
      .getByRole('navigation', { name: 'Fight quick switch' })
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
