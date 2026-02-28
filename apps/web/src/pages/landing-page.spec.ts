/**
 * Playwright coverage for landing page critical flows.
 */
import { type Page, expect, test } from '@playwright/test'

import {
  e2eReportId,
  e2eReportResponse,
  e2eValidFreshReportUrl,
  setupThreatApiMocks,
} from '../test/helpers/e2e-threat-mocks'
import { KeyboardShortcutsOverlayObject } from '../test/page-objects/components/keyboard-shortcuts-overlay-object'
import { RecentReportsObject } from '../test/page-objects/landing-page/recent-reports-object'

async function fillReportInput(page: Page, value: string): Promise<void> {
  const reportInput = page.getByRole('combobox', { name: 'Open report' })
  await reportInput.click()
  await reportInput.fill(value)
}

test.describe('landing page', () => {
  test.beforeEach(async ({ page }) => {
    await setupThreatApiMocks(page)
  })

  test('pasting a valid link opens the report page with expected summary data', async ({
    page,
  }) => {
    const recentReports = new RecentReportsObject(page)

    await page.goto('/')
    await expect(recentReports.recentReportsSection()).toBeVisible()
    await expect(recentReports.noRecentReportsText()).toBeVisible()
    await fillReportInput(page, e2eValidFreshReportUrl)
    await page.getByRole('button', { name: 'Load report' }).click()

    await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}`))
  })

  test('pasting an invalid link shows a parse error', async ({ page }) => {
    await page.goto('/')
    await fillReportInput(
      page,
      'https://www.warcraftlogs.com/reports/not-supported-host',
    )
    await page.getByRole('button', { name: 'Load report' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('alert')).toContainText(
      'Unable to parse report input',
    )
  })

  test('shows keyboard shortcuts overlay on landing page', async ({ page }) => {
    const shortcutsOverlay = new KeyboardShortcutsOverlayObject(page)

    await page.goto('/')
    await expect(shortcutsOverlay.dialog()).toHaveCount(0)
    await shortcutsOverlay.open()
    await expect(shortcutsOverlay.dialog()).toBeVisible()
    await expect(
      shortcutsOverlay.shortcutListItem('Open report input'),
    ).toBeVisible()
    await expect(
      shortcutsOverlay.shortcutListItem('Toggle shortcuts panel'),
    ).toBeVisible()
    await shortcutsOverlay.clickOutside()
    await expect(shortcutsOverlay.dialog()).toHaveCount(0)
  })

  test('empty state shows sample links, header guidance, and opens a report when clicked', async ({
    page,
  }) => {
    const recentReports = new RecentReportsObject(page)

    await page.goto('/')

    await expect(
      page.getByText('Paste a report into the input above'),
    ).toBeVisible()
    await expect(page.getByText(/Ctrl|⌘/)).toBeVisible()
    await expect(recentReports.exampleReportsSection()).toBeVisible()
    await expect(recentReports.exampleReportsList()).toBeVisible()
    await recentReports.exampleReportLink('Fresh Example').click()

    await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}`))
  })

  test('report history can be revisited from recent reports', async ({
    page,
  }) => {
    const recentReports = new RecentReportsObject(page)

    await page.goto('/')
    await fillReportInput(page, e2eValidFreshReportUrl)
    await page.getByRole('button', { name: 'Load report' }).click()

    await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}`))
    await expect(
      page.getByRole('region', { name: 'Report header' }),
    ).toContainText(e2eReportResponse.title)

    await page.goBack()
    await expect(page).toHaveURL('/')

    await expect(recentReports.recentReportsList()).toBeVisible()
    await recentReports.recentReportLink(e2eReportResponse.title).click()
    await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}`))
  })

  test('recent report tiles can be removed manually', async ({ page }) => {
    const recentReports = new RecentReportsObject(page)

    await page.goto('/')
    await fillReportInput(page, e2eValidFreshReportUrl)
    await page.getByRole('button', { name: 'Load report' }).click()
    await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}`))
    await expect(
      page.getByRole('region', { name: 'Report header' }),
    ).toContainText(e2eReportResponse.title)

    await page.goBack()
    await expect(page).toHaveURL('/')

    await expect(recentReports.recentReportsList()).toBeVisible()
    await recentReports
      .removeRecentReportButton(e2eReportResponse.title)
      .click()
    await expect(recentReports.noRecentReportsText()).toBeVisible()
  })

  test('clears report input value after submitting from landing and reopening on report route', async ({
    page,
  }) => {
    await page.goto('/')
    await fillReportInput(page, e2eValidFreshReportUrl)
    await page.getByRole('button', { name: 'Load report' }).click()
    await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}`))

    await page.getByRole('button', { name: 'Open report input' }).click()

    const reportInput = page.getByRole('combobox', { name: 'Open report' })
    await expect(reportInput).toHaveValue('')
  })

  test('submits a fully qualified report url when pressing Enter', async ({
    page,
  }) => {
    await page.goto('/')
    const reportInput = page.getByRole('combobox', { name: 'Open report' })
    await reportInput.click()
    await reportInput.fill(e2eValidFreshReportUrl)
    await reportInput.press('Enter')

    await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}`))
  })
})
