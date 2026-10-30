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
    return this.page
      .getByTestId('app-rail')
      .getByRole('region', { name: 'Report header' })
  }

  warcraftLogsReportLink(): Locator {
    return this.section().getByRole('link', {
      name: 'Open report on Warcraft Logs',
    })
  }

  appBar(): Locator {
    return this.page.getByTestId('app-bar')
  }

  fightCrumb(): Locator {
    return this.appBar().getByRole('button', { name: /^Fight:/ })
  }

  fightCrumbItem(name: string): Locator {
    return this.page.getByRole('menuitem', { name, exact: true })
  }

  warcraftLogsFightLink(fightName: string): Locator {
    return this.appBar().getByRole('link', {
      name: `Open ${fightName} on Warcraft Logs`,
    })
  }

  railAccount(): Locator {
    return this.page.getByTestId('rail-account')
  }

  threatConfigText(): Locator {
    return this.page.getByTestId('settings-threat-config')
  }
}
