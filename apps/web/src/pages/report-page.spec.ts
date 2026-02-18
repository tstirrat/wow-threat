/**
 * Playwright coverage for report page critical flows.
 */
import { expect, test } from '@playwright/test'

import {
  e2eReportId,
  setupThreatApiMocks,
} from '../test/helpers/e2e-threat-mocks'
import { FightQuickSwitcherObject } from '../test/page-objects/components/fight-quick-switcher-object'

test.describe('report page', () => {
  test.beforeEach(async ({ page }) => {
    await setupThreatApiMocks(page)
  })

  test('shows only boss kills in quick switch order', async ({ page }) => {
    const quickSwitch = new FightQuickSwitcherObject(page)

    await page.goto(`/report/${e2eReportId}`)

    await expect(quickSwitch.fightLinks()).toHaveCount(2)
    await expect(quickSwitch.fightLink('Patchwerk')).toBeVisible()
    await expect(quickSwitch.fightLink('Grobbulus')).toBeVisible()
    await expect(quickSwitch.fightText('Naxxramas Trash')).toHaveCount(0)
  })

  test('choosing a fight navigates to the threat chart page', async ({
    page,
  }) => {
    const quickSwitch = new FightQuickSwitcherObject(page)

    await page.goto(`/report/${e2eReportId}`)

    await quickSwitch.clickFight('Patchwerk')

    await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}/fight/26`))
    await expect(page.getByRole('region', { name: /Patchwerk/ })).toBeVisible()
  })

  test('does not render legacy report navigation sections', async ({ page }) => {
    await page.goto(`/report/${e2eReportId}`)

    await expect(
      page.getByRole('region', { name: 'Fight navigation' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('region', { name: 'Player navigation' }),
    ).toHaveCount(0)
  })
})
