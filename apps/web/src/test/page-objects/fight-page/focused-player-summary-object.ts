/**
 * Page object for focused-player summary elements.
 */
import { type Locator, type Page } from '@playwright/test'

export class FocusedPlayerSummaryObject {
  readonly section: Locator

  constructor(page: Page) {
    this.section = page.getByRole('region', { name: 'Focused player summary' })
  }

  breakdownTable(): Locator {
    return this.section.getByRole('table', {
      name: 'Focused player threat breakdown',
    })
  }

  totalRow(): Locator {
    return this.breakdownTable()
      .getByRole('row')
      .filter({ hasText: /^Total/ })
      .first()
  }

  emptyStateText(): Locator {
    return this.section.getByText('Click a chart line to focus an actor.')
  }

  focusedActorText(name: string): Locator {
    return this.section.getByText(name)
  }

  warcraftLogsLink(playerName: string): Locator {
    return this.section.getByRole('link', {
      name: `Open ${playerName} on Warcraft Logs`,
    })
  }

  metricText(metricLabel: string): Locator {
    return this.section.getByText(metricLabel)
  }
}
