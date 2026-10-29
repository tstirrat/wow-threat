/**
 * Page object for fight-page threat chart interactions.
 */
import { type Locator, type Page } from '@playwright/test'

type ChartRenderer = 'canvas' | 'missing' | 'none' | 'svg'

export class ThreatChartObject {
  readonly section: Locator

  constructor(private readonly page: Page) {
    this.section = page.getByRole('region', { name: /fight workspace$/i })
  }

  rosterRegion(): Locator {
    return this.section.locator('[data-region="roster"]')
  }

  rosterScrim(): Locator {
    return this.page.getByTestId('roster-scrim')
  }

  /** Chart / Player info switcher shown below 760px. */
  viewTab(name: 'Chart' | 'Player info'): Locator {
    return this.section
      .getByRole('tablist', { name: 'Fight views' })
      .getByRole('tab', { name, exact: true })
  }

  /** Tap the scrim to the left of the off-canvas roster. */
  async closeRosterWithScrim(): Promise<void> {
    await this.rosterScrim().click({ position: { x: 8, y: 400 } })
  }

  targetControl(): Locator {
    return this.page.getByTestId('app-bar-title').getByLabel('Target')
  }

  rosterToggle(): Locator {
    return this.page.getByRole('button', { name: /^(Hide|Show) roster$/ })
  }

  resetZoomButton(): Locator {
    return this.section.getByRole('button', { name: 'Reset zoom' })
  }

  legendRoot(): Locator {
    return this.rosterRegion().locator('[aria-label="Threat legend"]')
  }

  chartContainer(): Locator {
    return this.section.locator('.echarts-for-react')
  }

  legendToggle(name: string): Locator {
    return this.legendRoot().getByRole('button', {
      name: `Toggle ${name}`,
      exact: true,
    })
  }

  legendFocus(name: string): Locator {
    return this.legendRoot().getByRole('button', {
      name: `Focus ${name}`,
      exact: true,
    })
  }

  legendPin(name: string): Locator {
    return this.legendRoot().getByRole('button', {
      name: `Toggle pin ${name}`,
      exact: true,
    })
  }

  legendThreatOverrides(name: string): Locator {
    return this.legendRoot().getByRole('button', {
      name: `Threat overrides for ${name}`,
      exact: true,
    })
  }

  legendListItem(name: string): Locator {
    return this.legendToggle(name).locator('xpath=ancestor::li[1]')
  }

  legendRoleIndicator(name: string, role: 'Healer' | 'Tank'): Locator {
    return this.legendToggle(name).getByLabel(`${role} role`)
  }

  legendOverrideIndicator(name: string): Locator {
    return this.legendToggle(name).getByLabel('Threat overrides active')
  }

  clearIsolateButton(): Locator {
    return this.legendRoot().getByRole('button', { name: 'Clear selections' })
  }

  async renderer(): Promise<ChartRenderer> {
    const chartContainer = this.chartContainer()
    if ((await chartContainer.count()) === 0) {
      return 'missing'
    }

    if ((await chartContainer.locator('svg').count()) > 0) {
      return 'svg'
    }

    if ((await chartContainer.locator('canvas').count()) > 0) {
      return 'canvas'
    }

    return 'none'
  }

  async selectTarget(targetLabel: string): Promise<void> {
    const targetControl = this.targetControl()

    await targetControl.click()
    await this.page
      .getByRole('option', {
        name: targetLabel,
        exact: true,
      })
      .click()
  }

  async toggleLegend(name: string): Promise<void> {
    await this.legendToggle(name).click()
  }

  async isolateLegend(name: string): Promise<void> {
    await this.legendToggle(name).dblclick()
  }

  async focusLegend(name: string): Promise<void> {
    await this.legendFocus(name).click()
  }

  async toggleLegendPin(name: string): Promise<void> {
    await this.legendPin(name).click()
  }

  async openLegendThreatOverrides(name: string): Promise<void> {
    await this.legendListItem(name).hover()
    await this.legendThreatOverrides(name).click()
  }

  async legendToggleLabels(): Promise<string[]> {
    return this.legendRoot()
      .locator('button[aria-label^="Toggle "]')
      .evaluateAll((elements) =>
        elements
          .map((element) => element.getAttribute('aria-label') ?? '')
          .filter(
            (label) =>
              label.startsWith('Toggle ') && !label.startsWith('Toggle pin '),
          )
          .map((label) => label.replace('Toggle ', '')),
      )
  }

  async clearIsolate(): Promise<void> {
    await this.clearIsolateButton().click()
  }
}
