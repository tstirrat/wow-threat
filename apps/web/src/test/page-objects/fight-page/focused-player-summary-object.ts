/**
 * Page object for focused-player summary elements.
 */
import { type Locator, type Page } from '@playwright/test'

export class FocusedPlayerSummaryObject {
  readonly drawer: Locator
  readonly section: Locator

  constructor(page: Page) {
    this.drawer = page
      .locator('[data-region="drawer"]')
      .getByRole('region', { name: 'Player info' })
    this.section = this.drawer
  }

  toggleButton(): Locator {
    return this.drawer.getByRole('button', {
      name: /^(Collapse|Expand) player info$/,
    })
  }

  shortcutsButton(): Locator {
    return this.drawer.getByRole('button', { name: 'Show keyboard shortcuts' })
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
    return this.section.getByText(name).first()
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
