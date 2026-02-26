/**
 * Playwright coverage for landing page critical flows.
 */
import { expect, test } from '@playwright/test'

import {
  e2eReportId,
  e2eReportResponse,
  e2eValidFreshReportUrl,
  setupThreatApiMocks,
} from '../test/helpers/e2e-threat-mocks'
import { RecentReportsObject } from '../test/page-objects/landing-page/recent-reports-object'

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
    await page.getByLabel('Open report').fill(e2eValidFreshReportUrl)
    await page.getByRole('button', { name: 'Load report' }).click()

    await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}`))
  })

  test('pasting an invalid link shows a parse error', async ({ page }) => {
    await page.goto('/')
    await page
      .getByLabel('Open report')
      .fill('https://www.warcraftlogs.com/reports/not-supported-host')
    await page.getByRole('button', { name: 'Load report' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('alert')).toContainText(
      'Unable to parse report input',
    )
  })

  test('empty state shows sample links, header guidance, and opens a report when clicked', async ({
    page,
  }) => {
    const recentReports = new RecentReportsObject(page)

    await page.goto('/')

    await expect(page.getByText('Use the header input above to paste a Warcraft Logs URL or report code.')).toBeVisible()
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
    await page.getByLabel('Open report').fill(e2eValidFreshReportUrl)
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
    await page.getByLabel('Open report').fill(e2eValidFreshReportUrl)
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
})
