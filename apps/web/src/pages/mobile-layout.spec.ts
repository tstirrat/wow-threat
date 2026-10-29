/**
 * Playwright coverage for the mobile (< 760px) layout: off-canvas rail and roster, chart tabs, no horizontal scroll.
 */
import { type Page, expect, test } from '@playwright/test'

import {
  e2eReportId,
  setupThreatApiMocks,
} from '../test/helpers/e2e-threat-mocks'
import { AppShellObject } from '../test/page-objects/components/app-shell-object'
import { FightPageObject } from '../test/page-objects/fight-page'

const fightUrl = `/report/${e2eReportId}/fight/26?renderer=svg`

async function expectPathname(page: Page, value: string): Promise<void> {
  await expect(page).toHaveURL((url) => url.pathname === value)
}

test.use({ viewport: { width: 375, height: 812 } })

test.describe('mobile layout', () => {
  test.beforeEach(async ({ page }) => {
    await setupThreatApiMocks(page)
  })

  test('opens the rail from the menu, closes it with the scrim and Escape, and closes it after picking a fight', async ({
    page,
  }) => {
    const shell = new AppShellObject(page)
    const fightPage = new FightPageObject(page)

    await page.goto(`/report/${e2eReportId}`)
    await expect(shell.rail).toBeHidden()

    await shell.openRail()
    await expect(shell.rail).toBeVisible()
    await shell.closeRailWithScrim()
    await expect(shell.rail).toBeHidden()

    await shell.openRail()
    await expect(shell.rail).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(shell.rail).toBeHidden()

    await shell.openRail()
    await fightPage.quickSwitch.clickFight('Patchwerk')
    await expectPathname(page, `/report/${e2eReportId}/fight/26`)
    await expect(shell.rail).toBeHidden()
    await expect(fightPage.chart.section).toBeVisible()
  })

  test('opens the roster from the bar toggle and R, closing it with the scrim and Escape', async ({
    page,
  }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(fightUrl)
    await expect(fightPage.chart.chartContainer()).toBeVisible()
    await expect(fightPage.chart.rosterRegion()).toBeHidden()

    await fightPage.chart.rosterToggle().click()
    await expect(fightPage.chart.legendToggle('Aegistank')).toBeVisible()
    await fightPage.chart.closeRosterWithScrim()
    await expect(fightPage.chart.rosterRegion()).toBeHidden()

    await page.keyboard.press('r')
    await expect(fightPage.chart.legendToggle('Aegistank')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(fightPage.chart.rosterRegion()).toBeHidden()
  })

  test('switches between the chart and player info tabs', async ({ page }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(fightUrl)
    await expect(fightPage.chart.viewTab('Chart')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(fightPage.chart.chartContainer()).toBeVisible()
    await expect(fightPage.summary.drawer).toBeHidden()

    await fightPage.chart.viewTab('Player info').click()
    await expect(fightPage.summary.emptyStateText()).toBeVisible()
    await expect(fightPage.chart.chartRegion()).toBeHidden()

    await fightPage.chart.viewTab('Chart').click()
    await expect(fightPage.chart.chartContainer()).toBeVisible()
    await expect(fightPage.summary.drawer).toBeHidden()
  })

  test('fits 375px without horizontal scroll and keeps bar buttons at least 40px', async ({
    page,
  }) => {
    const shell = new AppShellObject(page)
    const fightPage = new FightPageObject(page)

    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Open a Warcraft Logs report' }),
    ).toBeVisible()
    expect(await shell.horizontalOverflow()).toBeLessThanOrEqual(0)

    await page.goto(`/report/${e2eReportId}`)
    await expect(shell.menuButton()).toBeVisible()
    expect(await shell.horizontalOverflow()).toBeLessThanOrEqual(0)

    await fightPage.goto(fightUrl)
    await expect(fightPage.chart.chartContainer()).toBeVisible()
    expect(await shell.horizontalOverflow()).toBeLessThanOrEqual(0)

    const chartBox = await fightPage.chart.chartRegion().boundingBox()
    expect(chartBox?.height ?? 0).toBeGreaterThanOrEqual(240)

    const buttons = await shell.barButtons().all()
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      const box = await button.boundingBox()
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(40)
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40)
    }
  })

  test('opens settings as a full-width sheet', async ({ page }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(fightUrl)
    await expect(fightPage.chart.chartContainer()).toBeVisible()
    await fightPage.settings.gearButton().click()

    await expect(fightPage.settings.panel()).toBeVisible()
    const box = await fightPage.settings.panel().boundingBox()
    expect(box?.width).toBe(375)
  })
})
