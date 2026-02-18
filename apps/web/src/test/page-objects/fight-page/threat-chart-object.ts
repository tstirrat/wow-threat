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

  chartContainer(): Locator {
    return this.section.locator('.echarts-for-react')
  }

  legendToggle(name: string): Locator {
    return this.legendRoot().getByRole('button', {
      name: `Toggle ${name}`,
      exact: true,
    })
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
