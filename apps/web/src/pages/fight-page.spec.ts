/**
 * Playwright coverage for fight page chart and interaction flows.
 */
import { type Page, expect, test } from '@playwright/test'

import {
  e2eReportId,
  setupThreatApiMocks,
} from '../test/helpers/e2e-threat-mocks'

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
    ({ lineStrokeColor }: { lineStrokeColor: string }) => {
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

  const fightHeader = page.getByRole('region', {
    name: 'Patchwerk (Fight #26)',
  })
  await expect(fightHeader.getByText('Warcraft Logs:')).toBeVisible()
  await expect(
    fightHeader.getByRole('link', { name: 'Report', exact: true }),
  ).toBeVisible()
  await expect(
    fightHeader.getByRole('link', { name: 'Fight', exact: true }),
  ).toBeVisible()

  const fightQuickSwitch = page.getByRole('navigation', {
    name: 'Fight quick switch',
  })
  await expect(fightQuickSwitch.getByText('Patchwerk')).toBeVisible()
  await expect(
    fightQuickSwitch.getByRole('link', { name: 'Grobbulus' }),
  ).toBeVisible()
  await expect(fightQuickSwitch.getByText('Naxxramas Trash')).toHaveCount(0)
  await expect(
    page.getByText(
      'Player threat lines with a scrollable legend sorted by total threat. Click a line to focus a player. Selected target is synced with URL query params for deep linking.',
    ),
  ).toHaveCount(0)

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

  await expect(page.getByLabel('Target')).toHaveValue('100:0')
  const legendRegion = page.getByRole('region', { name: 'Threat legend' })
  await expect(
    legendRegion.getByRole('button', { name: 'Toggle Aegistank' }),
  ).toBeVisible()
  await expect(
    legendRegion.getByRole('button', { name: 'Toggle Bladefury' }),
  ).toBeVisible()
  await expect(
    legendRegion.getByRole('button', { name: 'Toggle Arrowyn' }),
  ).toBeVisible()
  await expect(
    legendRegion.getByRole('button', { name: 'Toggle Wolfie (Arrowyn)' }),
  ).toHaveCount(0)

  const showPets = page.getByRole('checkbox', { name: 'Show pets' })
  await expect(showPets).not.toBeChecked()
  await showPets.check()
  await expect
    .poll(() =>
      page.evaluate(() =>
        new URLSearchParams(window.location.search).get('pets'),
      ),
    )
    .toBe('true')
  await expect(
    legendRegion.getByRole('button', { name: 'Toggle Wolfie (Arrowyn)' }),
  ).toBeVisible()
  await expect(
    legendRegion.getByRole('button', {
      name: 'Toggle Searing Totem (Arrowyn)',
    }),
  ).toHaveCount(0)
})

test('supports legend toggling, isolate on double click, and target switching', async ({
  page,
}) => {
  await page.goto(svgFightUrl)

  const legendRegion = page.getByRole('region', { name: 'Threat legend' })
  const aegistankLegend = legendRegion.getByRole('button', {
    name: 'Toggle Aegistank',
  })
  const bladefuryLegend = legendRegion.getByRole('button', {
    name: 'Toggle Bladefury',
  })

  await bladefuryLegend.click()
  await expect(bladefuryLegend).toHaveAttribute('aria-pressed', 'false')
  await expect
    .poll(() =>
      page.evaluate(() =>
        new URLSearchParams(window.location.search).get('players'),
      ),
    )
    .toBe('1,3')

  await bladefuryLegend.click()
  await expect(bladefuryLegend).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(() =>
      page.evaluate(() =>
        new URLSearchParams(window.location.search).get('players'),
      ),
    )
    .toBeNull()

  await aegistankLegend.dblclick()
  await expect(aegistankLegend).toHaveAttribute('aria-pressed', 'true')
  await expect(bladefuryLegend).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Clear isolate' }).click()
  await expect(bladefuryLegend).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(() =>
      page.evaluate(() =>
        new URLSearchParams(window.location.search).get('players'),
      ),
    )
    .toBeNull()

  await page.getByLabel('Target').selectOption('102:0')
  await expect(page.getByLabel('Target')).toHaveValue('102:0')
  await expect(page).toHaveURL(/targetId=102/)
})

test('applies players query param as initial legend visibility', async ({
  page,
}) => {
  await page.goto(`${svgFightUrl}&players=1`)

  const legendRegion = page.getByRole('region', { name: 'Threat legend' })
  const aegistankLegend = legendRegion.getByRole('button', {
    name: 'Toggle Aegistank',
  })
  const bladefuryLegend = legendRegion.getByRole('button', {
    name: 'Toggle Bladefury',
  })

  await expect(aegistankLegend).toBeVisible()
  await expect(bladefuryLegend).toBeVisible()
  await expect(aegistankLegend).toHaveAttribute('aria-pressed', 'true')
  await expect(bladefuryLegend).toHaveAttribute('aria-pressed', 'false')
  await expect(
    page.getByRole('button', { name: 'Clear isolate' }),
  ).toBeVisible()

  await bladefuryLegend.click()
  await expect(bladefuryLegend).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(() =>
      page.evaluate(() =>
        new URLSearchParams(window.location.search).get('players'),
      ),
    )
    .toBe('1,2')

  await page.getByRole('button', { name: 'Clear isolate' }).click()
  await expect(bladefuryLegend).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(() =>
      page.evaluate(() =>
        new URLSearchParams(window.location.search).get('players'),
      ),
    )
    .toBeNull()
})

test('applies pets query param as initial checkbox state', async ({ page }) => {
  await page.goto(`${svgFightUrl}&pets=true`)

  const showPets = page.getByRole('checkbox', { name: 'Show pets' })
  await expect(showPets).toBeChecked()

  const legendRegion = page.getByRole('region', { name: 'Threat legend' })
  await expect(
    legendRegion.getByRole('button', { name: 'Toggle Wolfie (Arrowyn)' }),
  ).toBeVisible()
})

test('clicking a chart point focuses a player and shows total threat values', async ({
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

  await expect(
    page.getByText('Click a chart line to focus a player.'),
  ).toBeVisible()

  await clickSeriesLineByStroke({
    page,
    strokeColor: 'rgb(199, 156, 110)',
  })
  await expect(page).toHaveURL(/focusId=1/)

  const summaryRegion = page.getByRole('region', {
    name: 'Focused player summary',
  })
  await expect(summaryRegion.getByText('Aegistank')).toBeVisible()
  await expect(summaryRegion.getByText('Total threat')).toBeVisible()

  const breakdownTable = summaryRegion.getByRole('table', {
    name: 'Focused player threat breakdown',
  })
  const totalRow = breakdownTable.getByRole('row').nth(1)

  await expect(totalRow.getByRole('cell').first()).toHaveText('Total')
  await expect(totalRow.getByRole('cell').nth(2)).toHaveText('550')
})
