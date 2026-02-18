/**
 * Page object for shared report header links and metadata.
 */
import { type Locator, type Page } from '@playwright/test'

export class FightPageHeaderObject {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  section(): Locator {
    return this.page.getByRole('region', { name: 'Report header' })
  }

  warcraftLogsReportLink(): Locator {
    return this.section().getByRole('link', {
      name: 'Open report on Warcraft Logs',
    })
  }

  threatConfigText(): Locator {
    return this.section().getByText('Threat config:')
  }
}
