/**
 * Page object for the rail library's recent reports and the landing box's example reports.
 */
import { type Locator, type Page } from '@playwright/test'

export class RecentReportsObject {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  recentReportsSection(): Locator {
    return this.page
      .getByTestId('app-rail')
      .getByRole('region', { name: /Recent logs/i })
  }

  noRecentReportsText(): Locator {
    return this.recentReportsSection().getByText(
      /Load a report to populate zone/i,
    )
  }

  recentReportsList(): Locator {
    return this.recentReportsSection().getByRole('list', {
      name: 'Recent reports',
    })
  }

  recentReportLink(name: string): Locator {
    return this.recentReportsSection().getByRole('link', {
      name,
    })
  }

  removeRecentReportButton(name: string): Locator {
    return this.recentReportsSection().getByRole('button', {
      name: `Remove recent report ${name}`,
    })
  }

  exampleReportsSection(): Locator {
    return this.page.getByRole('region', { name: 'Open a report' })
  }

  exampleReportsList(): Locator {
    return this.exampleReportsSection().getByRole('list', {
      name: 'Example reports',
    })
  }

  exampleReportLink(name: string): Locator {
    return this.exampleReportsSection().getByRole('link', {
      name: new RegExp(name),
    })
  }
}
