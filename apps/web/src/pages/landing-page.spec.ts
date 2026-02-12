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

test.beforeEach(async ({ page }) => {
  await setupThreatApiMocks(page)
})

test('pasting a valid link opens the report page with expected summary data', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Report URL or ID').fill(e2eValidFreshReportUrl)
  await page.getByRole('button', { name: 'Load report' }).click()

  await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}`))
  await expect(
    page.getByRole('heading', { level: 2, name: e2eReportResponse.title }),
  ).toBeVisible()
  await expect(page.getByText('Owner: ThreatOfficer')).toBeVisible()
  await expect(page.getByText('Fights: 4')).toBeVisible()
  await expect(page.getByText('Players: 3')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Patchwerk', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Grobbulus', exact: true })).toBeVisible()
})

test('pasting an invalid link shows a parse error', async ({ page }) => {
  await page.goto('/')
  await page
    .getByLabel('Report URL or ID')
    .fill('https://www.warcraftlogs.com/reports/not-supported-host')
  await page.getByRole('button', { name: 'Load report' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('alert')).toContainText(
    'Unable to parse report input',
  )
})

test('empty state shows sample links and opens a report when clicked', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Example reports' })).toBeVisible()
  await page.getByRole('link', { name: 'Fresh Example' }).click()

  await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}`))
  await expect(
    page.getByRole('heading', { level: 2, name: e2eReportResponse.title }),
  ).toBeVisible()
})

test('report history can be revisited from recent reports', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Report URL or ID').fill(e2eValidFreshReportUrl)
  await page.getByRole('button', { name: 'Load report' }).click()

  await expect(
    page.getByRole('heading', { level: 2, name: e2eReportResponse.title }),
  ).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL('/')

  await page.getByRole('link', { name: e2eReportResponse.title }).click()
  await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}`))
})
