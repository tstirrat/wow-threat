/**
 * Playwright coverage for fight page chart and interaction flows.
 */
import { expect, test, type Page } from '@playwright/test'

import { e2eReportId, setupThreatApiMocks } from '../test/helpers/e2e-threat-mocks'

const svgFightUrl = `/report/${e2eReportId}/fight/26?renderer=svg`

/** Click a rendered SVG line by stroke color. */
async function clickSeriesLineByStroke({
  page,
  strokeColor,
}: {
  page: Page
  strokeColor: string
}): Promise<void> {
  const clickPoint = await page.evaluate(
    ({
      lineStrokeColor,
    }: {
      lineStrokeColor: string
    }) => {
      const svg = document.querySelector('main svg')
      if (!svg) {
        return null
      }

      const matchingPaths = [...svg.querySelectorAll<SVGPathElement>('path')]
        .filter((path) => {
          const computedStyle = window.getComputedStyle(path)
          if (computedStyle.fill !== 'none') {
            return false
          }

          return computedStyle.stroke === lineStrokeColor
        })
        .filter((path) => path.getTotalLength() > 300)
      const targetPath = matchingPaths.sort(
        (left, right) => right.getTotalLength() - left.getTotalLength(),
      )[0]

      if (!targetPath) {
        return null
      }

      const point = targetPath.getPointAtLength(targetPath.getTotalLength() * 0.7)
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

  expect(clickPoint).not.toBeNull()
  await page.mouse.click(clickPoint?.x ?? 0, clickPoint?.y ?? 0)
}

test.beforeEach(async ({ page }) => {
  await setupThreatApiMocks(page)
})

test('defaults to the main boss and shows expected players in the legend', async ({
  page,
}) => {
  await page.goto(svgFightUrl)
  await expect(page).toHaveURL(/renderer=svg/)

  await expect
    .poll(() =>
      page.evaluate(() => {
        const chartContainer = document.querySelector('.echarts-for-react')
        if (!chartContainer) {
          return 'missing'
        }

        if (chartContainer.querySelector('svg')) {
          return 'svg'
        }

        if (chartContainer.querySelector('canvas')) {
          return 'canvas'
        }

        return 'none'
      }),
    )
    .toBe('svg')

  await expect(page.getByLabel('Target')).toHaveValue('100')
  await expect(
    page.locator('main svg text', { hasText: 'Aegistank' }),
  ).toBeVisible()
  await expect(
    page.locator('main svg text', { hasText: 'Bladefury' }),
  ).toBeVisible()
  await expect(
    page.locator('main svg text', { hasText: 'Arrowyn' }),
  ).toBeVisible()
})

test('supports legend toggling, isolate on double click, and target switching', async ({
  page,
}) => {
  await page.goto(svgFightUrl)

  const aegistankLegend = page
    .locator('main svg text', { hasText: 'Aegistank' })
    .first()
  const bladefuryLegend = page
    .locator('main svg text', { hasText: 'Bladefury' })
    .first()

  await bladefuryLegend.click()
  await expect(bladefuryLegend).toBeVisible()
  await bladefuryLegend.click()
  await expect(bladefuryLegend).toBeVisible()

  await aegistankLegend.dblclick()
  await page.getByRole('button', { name: 'Clear isolate' }).click()

  await page.getByLabel('Target').selectOption('102')
  await expect(page.getByLabel('Target')).toHaveValue('102')
  await expect(page).toHaveURL(/targetId=102/)
})

test('clicking a chart point focuses a player and shows total threat values', async ({
  page,
}) => {
  await page.goto(svgFightUrl)

  await expect(
    page.getByText('Click a chart line to focus a player.'),
  ).toBeVisible()

  await clickSeriesLineByStroke({
    page,
    strokeColor: 'rgb(199, 156, 110)',
  })

  const summaryRegion = page.getByRole('region', { name: 'Focused player summary' })
  await expect(summaryRegion.getByText('Aegistank')).toBeVisible()
  await expect(summaryRegion.getByText('Total threat')).toBeVisible()
  await expect(summaryRegion.getByText('550')).toBeVisible()
})
