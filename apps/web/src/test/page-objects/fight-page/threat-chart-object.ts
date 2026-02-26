/**
 * Page object for fight-page threat chart interactions.
 */
import { type Locator, type Page } from '@playwright/test'

type ChartRenderer = 'canvas' | 'missing' | 'none' | 'svg'

type Point = {
  x: number
  y: number
}

export class ThreatChartObject {
  readonly section: Locator

  constructor(private readonly page: Page) {
    this.section = page
      .getByRole('region')
      .filter({ has: page.getByLabel('Target') })
      .first()
  }

  targetControl(): Locator {
    return this.section.getByLabel('Target')
  }

  legendRoot(): Locator {
    return this.section.locator('[aria-label="Threat legend"]')
  }

  showPetsCheckbox(): Locator {
    return this.section.getByRole('checkbox', { name: 'Show pets' })
  }

  showEnergizeEventsCheckbox(): Locator {
    return this.section.getByRole('checkbox', { name: 'Show energize events' })
  }

  showBossMeleeCheckbox(): Locator {
    return this.section.getByRole('checkbox', { name: 'Show boss melee' })
  }

  inferThreatReductionCheckbox(): Locator {
    return this.section.getByRole('checkbox', {
      name: 'Infer threat reduction buffs',
    })
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

  legendListItem(name: string): Locator {
    return this.legendToggle(name).locator('xpath=ancestor::li[1]')
  }

  clearIsolateButton(): Locator {
    return this.section.getByRole('button', { name: 'Clear isolate' })
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

  async legendToggleLabels(): Promise<string[]> {
    return this.legendRoot()
      .locator('button[aria-label^="Toggle "]')
      .evaluateAll((elements) =>
        elements
          .map((element) => element.getAttribute('aria-label') ?? '')
          .filter((label) => label.startsWith('Toggle '))
          .map((label) => label.replace('Toggle ', '')),
      )
  }

  async clearIsolate(): Promise<void> {
    await this.clearIsolateButton().click()
  }

  async setShowPets(checked: boolean): Promise<void> {
    const showPetsCheckbox = this.showPetsCheckbox()
    const isChecked = await showPetsCheckbox.isChecked()

    if (isChecked === checked) {
      return
    }

    await showPetsCheckbox.click()
  }

  async setShowEnergizeEvents(checked: boolean): Promise<void> {
    const showEnergizeEventsCheckbox = this.showEnergizeEventsCheckbox()
    const isChecked = await showEnergizeEventsCheckbox.isChecked()

    if (isChecked === checked) {
      return
    }

    await showEnergizeEventsCheckbox.click()
  }

  async setShowBossMelee(checked: boolean): Promise<void> {
    const showBossMeleeCheckbox = this.showBossMeleeCheckbox()
    const isChecked = await showBossMeleeCheckbox.isChecked()

    if (isChecked === checked) {
      return
    }

    await showBossMeleeCheckbox.click()
  }

  async setInferThreatReduction(checked: boolean): Promise<void> {
    const inferThreatReductionCheckbox = this.inferThreatReductionCheckbox()
    const isChecked = await inferThreatReductionCheckbox.isChecked()

    if (isChecked === checked) {
      return
    }

    await inferThreatReductionCheckbox.click()
  }

  async seriesClickPointByStroke(strokeColor: string): Promise<Point | null> {
    return this.page.evaluate(
      ({ lineStrokeColor }: { lineStrokeColor: string }) => {
        const normalizeColor = (value: string): string =>
          value.toLowerCase().replaceAll(/\s+/g, '')

        const chartContainer = document.querySelector('.echarts-for-react')
        const svg = chartContainer?.querySelector('svg')
        if (!svg) {
          return null
        }

        const expectedStroke = normalizeColor(lineStrokeColor)
        const matchingPaths = [...svg.querySelectorAll<SVGPathElement>('path')]
          .filter((path) => {
            const computedStyle = window.getComputedStyle(path)
            if (computedStyle.fill !== 'none') {
              return false
            }

            const currentStroke = normalizeColor(computedStyle.stroke)
            return currentStroke === expectedStroke
          })
          .filter((path) => path.getTotalLength() > 120)

        const targetPath = matchingPaths.sort(
          (left, right) => right.getTotalLength() - left.getTotalLength(),
        )[0]
        if (!targetPath) {
          return null
        }

        const point = targetPath.getPointAtLength(
          targetPath.getTotalLength() * 0.7,
        )
        const rect = svg.getBoundingClientRect()
        return {
          x: rect.left + point.x,
          y: rect.top + point.y,
        }
      },
      {
        lineStrokeColor: strokeColor,
      },
    )
  }

  async clickSeriesLineByStroke(strokeColor: string): Promise<boolean> {
    const clickPoint = await this.seriesClickPointByStroke(strokeColor)
    if (!clickPoint) {
      return false
    }

    await this.page.mouse.click(clickPoint.x, clickPoint.y)
    return true
  }
}
