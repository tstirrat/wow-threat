/**
 * Playwright coverage for report page critical flows.
 */
import { type Page, expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  e2eReportId,
  setupThreatApiMocks,
} from '../test/helpers/e2e-threat-mocks'
import { FightQuickSwitcherObject } from '../test/page-objects/components/fight-quick-switcher-object'

const repoRoot = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../..',
)
const screenshotPath = path.join(repoRoot, 'output', 'report-page.png')

async function expectPathname(page: Page, pathname: string): Promise<void> {
  await expect(page).toHaveURL((url) => url.pathname === pathname)
}

async function maybeCaptureScreenshot(page: Page): Promise<void> {
  if (!process.env.PLAYWRIGHT_SCREENSHOT) {
    return
  }

  await mkdir(path.dirname(screenshotPath), { recursive: true })
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  })
}

test.describe('report page', () => {
  test.beforeEach(async ({ page }) => {
    await setupThreatApiMocks(page)
  })

  test('opens the first fight when a report is opened', async ({ page }) => {
    await page.goto(`/report/${e2eReportId}`)

    await expect(page).toHaveURL((url) =>
      url.pathname.startsWith(`/report/${e2eReportId}/fight/`),
    )
    await expect(page.getByRole('region', { name: /Patchwerk/ })).toBeVisible()
    await maybeCaptureScreenshot(page)
  })

  test('shows boss kills and wipes in quick switch order', async ({ page }) => {
    const quickSwitch = new FightQuickSwitcherObject(page)

    await page.goto(`/report/${e2eReportId}`)

    await expect(quickSwitch.fightLinks()).toHaveCount(3)
    await expect(quickSwitch.fightLink('Patchwerk Wipe 12.4%')).toBeVisible()
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

    await expectPathname(page, `/report/${e2eReportId}/fight/26`)
    await expect(page.getByRole('region', { name: /Patchwerk/ })).toBeVisible()
  })

  test('does not render legacy report navigation sections', async ({
    page,
  }) => {
    await page.goto(`/report/${e2eReportId}`)

    await expect(
      page.getByRole('region', { name: 'Fight navigation' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('region', { name: 'Player navigation' }),
    ).toHaveCount(0)
  })
})
