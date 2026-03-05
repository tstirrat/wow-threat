/**
 * Playwright coverage for fight page chart and interaction flows.
 */
import { type Page, expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  e2eReportId,
  setupThreatApiMocks,
} from '../test/helpers/e2e-threat-mocks'
import { FightPageObject } from '../test/page-objects/fight-page'

const svgFightUrl = `/report/${e2eReportId}/fight/26?renderer=svg`
const repoRoot = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../..',
)
const screenshotPath = path.join(repoRoot, 'output', 'fight-page.png')

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

async function expectSearchParam(
  page: Page,
  paramName: string,
  value: string | null,
): Promise<void> {
  await expect(page).toHaveURL(
    (url) => url.searchParams.get(paramName) === value,
  )
}

async function expectSearchString(page: Page, value: string): Promise<void> {
  await expect(page).toHaveURL((url) => url.search === value)
}

async function expectPathname(page: Page, value: string): Promise<void> {
  await expect(page).toHaveURL((url) => url.pathname === value)
}

test.describe('fight page', () => {
  test.beforeEach(async ({ page }) => {
    await setupThreatApiMocks(page)
  })

  test('defaults to the main boss and shows expected players in the legend', async ({
    page,
  }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(svgFightUrl)
    await expectSearchParam(page, 'renderer', 'svg')

    const header = fightPage.header.section()
    await expect(header).toBeVisible()
    await expect(fightPage.header.threatConfigText()).toBeVisible()
    await expect(fightPage.header.warcraftLogsReportLink()).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Open Patchwerk on Warcraft Logs' }),
    ).toBeVisible()

    await expect(fightPage.quickSwitch.fightLink('Patchwerk')).toBeVisible()
    await expect(fightPage.quickSwitch.fightLink('Grobbulus')).toHaveAttribute(
      'href',
      `/report/${e2eReportId}/fight/30`,
    )
    await expect(
      fightPage.quickSwitch.fightText('Naxxramas Trash'),
    ).toHaveCount(0)
    await expect(
      page.getByText(
        'Player threat lines with a scrollable legend sorted by total threat. Click a line to focus a player. Selected target is synced with URL query params for deep linking.',
      ),
    ).toHaveCount(0)

    await expect.poll(() => fightPage.chart.renderer()).toBe('svg')
    await expect(fightPage.chart.targetControl()).toContainText(
      'Patchwerk (100)',
    )
    await expect(fightPage.chart.legendToggle('Aegistank')).toBeVisible()
    await expect(fightPage.chart.legendToggle('Bladefury')).toBeVisible()
    await expect(fightPage.chart.legendToggle('Arrowyn')).toBeVisible()
    await expect(
      fightPage.chart.legendRoleIndicator('Arrowyn', 'Healer'),
    ).toBeVisible()
    await expect(fightPage.chart.legendFocus('Aegistank')).toBeVisible()
    await expect(page.getByText('Fixate/Taunt')).toBeVisible()
    await expect(fightPage.chart.legendToggle('Wolfie')).toHaveCount(0)
    await maybeCaptureScreenshot(page)

    await expect(fightPage.chart.showEnergizeEventsCheckbox()).not.toBeChecked()
    await expect(fightPage.chart.showFixateBandsCheckbox()).toBeChecked()
    await expect(fightPage.chart.bossDamageMeleeToggle()).toBeChecked()
    await expect(
      fightPage.chart.inferThreatReductionCheckbox(),
    ).not.toBeChecked()
    await expect(fightPage.chart.showPetsCheckbox()).not.toBeChecked()
    await fightPage.chart.setShowPets(true)
    await expect(fightPage.chart.legendToggle('Wolfie')).toBeVisible()
    const labels = await fightPage.chart.legendToggleLabels()
    const ownerIndex = labels.indexOf('Arrowyn')
    const petIndex = labels.indexOf('Wolfie')
    expect(ownerIndex).toBeGreaterThanOrEqual(0)
    expect(petIndex).toBe(ownerIndex + 1)
    await expect(fightPage.chart.legendToggle('Searing Totem')).toHaveCount(0)
  })

  test('supports legend toggling, isolate on double click, and target switching', async ({
    page,
  }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(svgFightUrl)

    await fightPage.chart.toggleLegend('Bladefury')
    await expect(fightPage.chart.legendToggle('Bladefury')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expectSearchParam(page, 'players', '1,3')

    await fightPage.chart.toggleLegend('Bladefury')
    await expect(fightPage.chart.legendToggle('Bladefury')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expectSearchParam(page, 'players', null)

    await fightPage.chart.isolateLegend('Aegistank')
    await expect(fightPage.chart.legendToggle('Aegistank')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(fightPage.chart.legendToggle('Bladefury')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await fightPage.chart.clearIsolate()
    await expect(fightPage.chart.legendToggle('Bladefury')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expectSearchParam(page, 'players', null)

    await fightPage.chart.selectTarget('Hateful Strike Target (102)')
    await expect(fightPage.chart.targetControl()).toContainText(
      'Hateful Strike Target (102)',
    )
    await expectSearchParam(page, 'targetId', '102')
  })

  test('applies players query param as initial legend visibility', async ({
    page,
  }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(`${svgFightUrl}&players=1`)

    await expect(fightPage.chart.legendToggle('Aegistank')).toBeVisible()
    await expect(fightPage.chart.legendToggle('Bladefury')).toBeVisible()
    await expect(fightPage.chart.legendToggle('Aegistank')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(fightPage.chart.legendToggle('Bladefury')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(fightPage.chart.clearIsolateButton()).toBeVisible()

    await fightPage.chart.toggleLegend('Bladefury')
    await expect(fightPage.chart.legendToggle('Bladefury')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expectSearchParam(page, 'players', '1,2')

    await fightPage.chart.clearIsolate()
    await expect(fightPage.chart.legendToggle('Bladefury')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expectSearchParam(page, 'players', null)
  })

  test('quick switch links reset fight query params', async ({ page }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(
      `${svgFightUrl}&players=1&focusId=1&targetId=102&startMs=1000&endMs=2000`,
    )

    await expect(fightPage.quickSwitch.fightLink('Grobbulus')).toHaveAttribute(
      'href',
      `/report/${e2eReportId}/fight/30`,
    )
    await fightPage.quickSwitch.clickFight('Grobbulus')

    await expectPathname(page, `/report/${e2eReportId}/fight/30`)
    await expectSearchString(page, '')
  })

  test('pins players and keeps them on quick switch fight links', async ({
    page,
  }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(svgFightUrl)

    await fightPage.chart.legendListItem('Aegistank').hover()
    await fightPage.chart.toggleLegendPin('Aegistank')
    await expect(fightPage.chart.legendPin('Aegistank')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expectSearchParam(page, 'players', null)
    await expectSearchParam(page, 'pinnedPlayers', '1')

    await expect(fightPage.quickSwitch.fightLink('Grobbulus')).toHaveAttribute(
      'href',
      `/report/${e2eReportId}/fight/30?pinnedPlayers=1&players=1`,
    )
    await fightPage.quickSwitch.clickFight('Grobbulus')
    await expectPathname(page, `/report/${e2eReportId}/fight/30`)
    await expectSearchParam(page, 'pinnedPlayers', '1')
    await expectSearchParam(page, 'players', '1')
    await expect(fightPage.chart.legendPin('Aegistank')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('clearing selections resets players while keeping pinned players', async ({
    page,
  }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(svgFightUrl)

    await fightPage.chart.legendListItem('Aegistank').hover()
    await fightPage.chart.toggleLegendPin('Aegistank')
    await fightPage.chart.isolateLegend('Aegistank')

    await expectSearchParam(page, 'pinnedPlayers', '1')
    await expectSearchParam(page, 'players', '1')
    await expect(fightPage.chart.clearIsolateButton()).toBeVisible()

    await fightPage.chart.clearIsolate()

    await expect(fightPage.chart.legendPin('Aegistank')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expectSearchParam(page, 'pinnedPlayers', '1')
    await expectSearchParam(page, 'players', null)
  })

  test('persists show pets, show energize, show boss damage, and infer threat reduction toggles across fight switches', async ({
    page,
  }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(svgFightUrl)
    await expect(fightPage.chart.showEnergizeEventsCheckbox()).not.toBeChecked()
    await expect(fightPage.chart.showFixateBandsCheckbox()).toBeChecked()
    await expect(fightPage.chart.bossDamageMeleeToggle()).toBeChecked()
    await expect(
      fightPage.chart.inferThreatReductionCheckbox(),
    ).not.toBeChecked()
    await expect(fightPage.chart.showPetsCheckbox()).not.toBeChecked()

    await fightPage.chart.setShowEnergizeEvents(true)
    await fightPage.chart.setShowFixateBands(false)
    await fightPage.chart.setBossDamageMode('off')
    await fightPage.chart.setInferThreatReduction(true)
    await fightPage.chart.setShowPets(true)
    await expect(fightPage.chart.showEnergizeEventsCheckbox()).toBeChecked()
    await expect(fightPage.chart.showFixateBandsCheckbox()).not.toBeChecked()
    await expect(fightPage.chart.bossDamageOffToggle()).toBeChecked()
    await expect(fightPage.chart.inferThreatReductionCheckbox()).toBeChecked()
    await expect(fightPage.chart.showPetsCheckbox()).toBeChecked()

    await fightPage.quickSwitch.clickFight('Grobbulus')
    await expectPathname(page, `/report/${e2eReportId}/fight/30`)
    await expect(fightPage.chart.showEnergizeEventsCheckbox()).toBeChecked()
    await expect(fightPage.chart.showFixateBandsCheckbox()).not.toBeChecked()
    await expect(fightPage.chart.bossDamageOffToggle()).toBeChecked()
    await expect(fightPage.chart.inferThreatReductionCheckbox()).toBeChecked()
    await expect(fightPage.chart.showPetsCheckbox()).toBeChecked()

    await fightPage.quickSwitch.clickFight('Patchwerk')
    await expectPathname(page, `/report/${e2eReportId}/fight/26`)
    await expect(fightPage.chart.showEnergizeEventsCheckbox()).toBeChecked()
    await expect(fightPage.chart.showFixateBandsCheckbox()).not.toBeChecked()
    await expect(fightPage.chart.bossDamageOffToggle()).toBeChecked()
    await expect(fightPage.chart.inferThreatReductionCheckbox()).toBeChecked()
    await expect(fightPage.chart.showPetsCheckbox()).toBeChecked()
  })

  test('supports keyboard shortcuts for toggles, clear isolate, and shortcuts overlay', async ({
    page,
  }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(svgFightUrl)
    await expect(fightPage.chart.bossDamageMeleeToggle()).toBeChecked()
    await expect(fightPage.chart.showEnergizeEventsCheckbox()).not.toBeChecked()
    await expect(fightPage.chart.showPetsCheckbox()).not.toBeChecked()

    await page.keyboard.press('b')
    await expect(fightPage.chart.bossDamageAllToggle()).toBeChecked()
    await page.keyboard.press('p')
    await expect(fightPage.chart.showPetsCheckbox()).toBeChecked()
    await page.keyboard.press('e')
    await expect(fightPage.chart.showEnergizeEventsCheckbox()).toBeChecked()

    await fightPage.chart.isolateLegend('Aegistank')
    await expect(fightPage.chart.clearIsolateButton()).toBeVisible()
    await page.keyboard.press('c')
    await expect(fightPage.chart.clearIsolateButton()).toHaveCount(0)
    await expect(fightPage.chart.legendToggle('Bladefury')).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await fightPage.chart.focusLegend('Bladefury')
    await expectSearchParam(page, 'focusId', '2')
    await expect(fightPage.summary.focusedActorText('Bladefury')).toBeVisible()
    await page.keyboard.press('i')
    await expectSearchParam(page, 'players', '2')

    const playerSearch = page.getByRole('dialog', {
      name: 'Player search',
    })
    await expect(playerSearch).toHaveCount(0)
    await page.keyboard.press('/')
    await expect(playerSearch).toBeVisible()
    const playerSearchInput = playerSearch.getByRole('textbox', {
      name: 'Search players',
    })
    await expect(playerSearchInput).toBeFocused()
    await playerSearchInput.fill('aegi')
    await page.keyboard.press('Enter')
    await expect(playerSearch).toHaveCount(0)
    await expectSearchParam(page, 'focusId', '1')
    await expectSearchParam(page, 'players', '1')

    await page.keyboard.press('/')
    await expect(playerSearch).toBeVisible()
    await playerSearchInput.fill('blade')
    await page.keyboard.press('Shift+Enter')
    await expect(playerSearch).toHaveCount(0)
    await expectSearchParam(page, 'focusId', '2')
    await expectSearchParam(page, 'players', '1,2')

    await expect(fightPage.shortcuts.dialog()).toHaveCount(0)
    await fightPage.shortcuts.open()
    await expect(fightPage.shortcuts.dialog()).toBeVisible()
    await expect(
      fightPage.shortcuts.shortcutListItem('Cycle boss damage markers'),
    ).toBeVisible()
    await expect(
      fightPage.shortcuts.shortcutListItem('Toggle show pets'),
    ).toBeVisible()
    await expect(
      fightPage.shortcuts.shortcutListItem('Toggle show energize events'),
    ).toBeVisible()
    await expect(
      fightPage.shortcuts.shortcutListItem('Clear isolate'),
    ).toBeVisible()
    await expect(
      fightPage.shortcuts.shortcutListItem('Isolate focused player'),
    ).toBeVisible()
    await expect(
      fightPage.shortcuts.shortcutListItem('Open player search'),
    ).toBeVisible()
    await expect(
      fightPage.shortcuts.shortcutKey('Cycle boss damage markers', 'B'),
    ).toBeVisible()
    await expect(
      fightPage.shortcuts.shortcutKey('Toggle show pets', 'P'),
    ).toBeVisible()
    await expect(
      fightPage.shortcuts.shortcutKey('Toggle show energize events', 'E'),
    ).toBeVisible()
    await expect(
      fightPage.shortcuts.shortcutKey('Clear isolate', 'C'),
    ).toBeVisible()
    await expect(
      fightPage.shortcuts.shortcutKey('Isolate focused player', 'I'),
    ).toBeVisible()
    await expect(
      fightPage.shortcuts.shortcutKey('Open player search', '/'),
    ).toBeVisible()
    await fightPage.shortcuts.closeWithEscape()
    await expect(fightPage.shortcuts.dialog()).toHaveCount(0)
  })

  test('focusing a player shows total threat values', async ({ page }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(svgFightUrl)
    await expectSearchParam(page, 'renderer', 'svg')

    await expect.poll(() => fightPage.chart.renderer()).toBe('svg')
    await expect(fightPage.summary.emptyStateText()).toBeVisible()
    await fightPage.chart.focusLegend('Aegistank')
    await expectSearchParam(page, 'focusId', '1')

    await expect(fightPage.summary.focusedActorText('Aegistank')).toBeVisible()
    const focusedPlayerWclLink = fightPage.summary.warcraftLogsLink('Aegistank')
    await expect(focusedPlayerWclLink).toBeVisible()
    await expect(focusedPlayerWclLink).toHaveAttribute(
      'href',
      'https://fresh.warcraftlogs.com/character/us/benediction/aegistank',
    )
    await expect(focusedPlayerWclLink).toHaveAttribute('target', '_blank')
    await expect(focusedPlayerWclLink).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    )
    await expect(fightPage.summary.metricText('Total threat')).toBeVisible()
    await expect(
      fightPage.summary.totalRow().getByRole('cell').first(),
    ).toHaveText('Total')
    await expect(
      fightPage.summary.totalRow().getByRole('cell').nth(2),
    ).toHaveText('3,974.00')
  })

  test('focuses a player from the legend focus button', async ({ page }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(svgFightUrl)
    await fightPage.chart.focusLegend('Bladefury')

    await expectSearchParam(page, 'focusId', '2')
    await expect(fightPage.summary.focusedActorText('Bladefury')).toBeVisible()
  })

  test('keeps fight header visible while threat events are still loading', async ({
    page,
  }) => {
    const fightPage = new FightPageObject(page)

    await setupThreatApiMocks(page, {
      fightResponseDelayMs: 0,
      eventsResponseDelayMs: 2000,
    })
    await fightPage.goto(svgFightUrl)

    await expect(fightPage.chart.targetControl()).toBeVisible()
    await expect(fightPage.chart.resetZoomButton()).toBeVisible()
    await expect(fightPage.chart.resetZoomButton()).toBeDisabled()
    await expect(page.getByTestId('fight-chart-skeleton')).toBeVisible()
    await expect(
      page.getByRole('status', { name: 'Loading fight data' }),
    ).toHaveCount(0)
    await expect.poll(() => fightPage.chart.renderer()).toBe('svg')
    await expect(fightPage.chart.resetZoomButton()).toBeEnabled()
    await expect(page.getByTestId('fight-chart-skeleton')).toHaveCount(0)
  })
})
