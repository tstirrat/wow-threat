/**
 * Playwright coverage for report page critical flows.
 */
import { expect, test } from '@playwright/test'

import {
  e2eReportId,
  setupThreatApiMocks,
} from '../test/helpers/e2e-threat-mocks'

test.beforeEach(async ({ page }) => {
  await setupThreatApiMocks(page)
})

test('shows only boss kills in report order', async ({ page }) => {
  await page.goto(`/report/${e2eReportId}`)

  const fightNavigation = page.getByRole('region', { name: 'Fight navigation' })
  const bossKillLinks = fightNavigation.getByRole('link', { name: /Kill \(/ })

  await expect(bossKillLinks).toHaveCount(2)
  await expect(fightNavigation.getByText('Patchwerk')).toBeVisible()
  await expect(fightNavigation.getByText('Grobbulus')).toBeVisible()
  await expect(bossKillLinks.nth(0)).toContainText('Kill (2:00)')
  await expect(bossKillLinks.nth(1)).toContainText('Kill (1:15)')

  await expect(fightNavigation.getByText('Naxxramas Trash')).toHaveCount(0)
  await expect(fightNavigation.getByText('wipe 1')).toHaveCount(0)
})

test('choosing a fight navigates to the threat chart page', async ({
  page,
}) => {
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
  await expect(page.getByLabel('Target')).toHaveValue('100:0')
})
