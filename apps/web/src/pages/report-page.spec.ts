/**
 * Playwright coverage for report page critical flows.
 */
import { expect, test } from '@playwright/test'

import { e2eReportId, setupThreatApiMocks } from '../test/helpers/e2e-threat-mocks'

test.beforeEach(async ({ page }) => {
  await setupThreatApiMocks(page)
})

test('shows bosses with wipes and exposes trash fights', async ({ page }) => {
  await page.goto(`/report/${e2eReportId}`)

  await expect(page.getByRole('link', { name: 'Patchwerk', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'wipe 1' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Grobbulus', exact: true })).toBeVisible()

  await page.getByLabel('Show trash fights (1)').click()
  await expect(page.getByRole('link', { name: '#40' })).toBeVisible()
})

test('choosing a fight navigates to the threat chart page', async ({ page }) => {
  await page.goto(`/report/${e2eReportId}`)

  await page.getByRole('link', { name: 'Kill (2:00)' }).click()

  await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}/fight/26`))
  await expect(
    page.getByRole('heading', { level: 2, name: 'Patchwerk (Fight #26)' }),
  ).toBeVisible()
})

test('choosing a player + boss from player navigation goes to the expected chart', async ({
  page,
}) => {
  await page.goto(`/report/${e2eReportId}`)

  await page
    .getByRole('link', { name: 'Open Patchwerk chart for Aegistank' })
    .click()

  await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}/fight/26`))
  await expect(page).toHaveURL(/players=1/)
  await expect(page.getByLabel('Target')).toHaveValue('100')
})
