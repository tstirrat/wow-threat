/**
 * Playwright coverage for fight page chart and interaction flows.
 */
import { expect, test } from '@playwright/test'

import {
  e2eReportId,
  setupThreatApiMocks,
} from '../test/helpers/e2e-threat-mocks'
import { FightPageObject } from '../test/page-objects/fight-page'

const svgFightUrl = `/report/${e2eReportId}/fight/26?renderer=svg`

test.describe('fight page', () => {
  test.beforeEach(async ({ page }) => {
    await setupThreatApiMocks(page)
  })

  test('defaults to the main boss and shows expected players in the legend', async ({
    page,
  }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(svgFightUrl)
    await expect(page).toHaveURL(/renderer=svg/)

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
    await expect(fightPage.chart.legendFocus('Aegistank')).toBeVisible()
    await expect(fightPage.chart.legendToggle('Wolfie')).toHaveCount(0)

    await expect(fightPage.chart.showEnergizeEventsCheckbox()).not.toBeChecked()
    await expect(fightPage.chart.showBossMeleeCheckbox()).toBeChecked()
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
    await expect.poll(() => fightPage.searchParam('players')).toBe('1,3')

    await fightPage.chart.toggleLegend('Bladefury')
    await expect(fightPage.chart.legendToggle('Bladefury')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect.poll(() => fightPage.searchParam('players')).toBeNull()

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
    await expect.poll(() => fightPage.searchParam('players')).toBeNull()

    await fightPage.chart.selectTarget('Hateful Strike Target (102)')
    await expect(fightPage.chart.targetControl()).toContainText(
      'Hateful Strike Target (102)',
    )
    await expect(page).toHaveURL(/targetId=102/)
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
    await expect.poll(() => fightPage.searchParam('players')).toBe('1,2')

    await fightPage.chart.clearIsolate()
    await expect(fightPage.chart.legendToggle('Bladefury')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect.poll(() => fightPage.searchParam('players')).toBeNull()
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

    await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}/fight/30$`))
    await expect.poll(() => fightPage.searchString()).toBe('')
  })

  test('persists show pets, show energize, show boss damage, and infer threat reduction toggles across fight switches', async ({
    page,
  }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(svgFightUrl)
    await expect(fightPage.chart.showEnergizeEventsCheckbox()).not.toBeChecked()
    await expect(fightPage.chart.showBossMeleeCheckbox()).toBeChecked()
    await expect(
      fightPage.chart.inferThreatReductionCheckbox(),
    ).not.toBeChecked()
    await expect(fightPage.chart.showPetsCheckbox()).not.toBeChecked()

    await fightPage.chart.setShowEnergizeEvents(true)
    await fightPage.chart.setShowBossMelee(false)
    await fightPage.chart.setInferThreatReduction(true)
    await fightPage.chart.setShowPets(true)
    await expect(fightPage.chart.showEnergizeEventsCheckbox()).toBeChecked()
    await expect(fightPage.chart.showBossMeleeCheckbox()).not.toBeChecked()
    await expect(fightPage.chart.inferThreatReductionCheckbox()).toBeChecked()
    await expect(fightPage.chart.showPetsCheckbox()).toBeChecked()

    await fightPage.quickSwitch.clickFight('Grobbulus')
    await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}/fight/30$`))
    await expect(fightPage.chart.showEnergizeEventsCheckbox()).toBeChecked()
    await expect(fightPage.chart.showBossMeleeCheckbox()).not.toBeChecked()
    await expect(fightPage.chart.inferThreatReductionCheckbox()).toBeChecked()
    await expect(fightPage.chart.showPetsCheckbox()).toBeChecked()

    await fightPage.quickSwitch.clickFight('Patchwerk')
    await expect(page).toHaveURL(new RegExp(`/report/${e2eReportId}/fight/26$`))
    await expect(fightPage.chart.showEnergizeEventsCheckbox()).toBeChecked()
    await expect(fightPage.chart.showBossMeleeCheckbox()).not.toBeChecked()
    await expect(fightPage.chart.inferThreatReductionCheckbox()).toBeChecked()
    await expect(fightPage.chart.showPetsCheckbox()).toBeChecked()
  })

  test('supports keyboard shortcuts for toggles, clear isolate, and shortcuts overlay', async ({
    page,
  }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(svgFightUrl)
    await expect(fightPage.chart.showBossMeleeCheckbox()).toBeChecked()
    await expect(fightPage.chart.showEnergizeEventsCheckbox()).not.toBeChecked()
    await expect(fightPage.chart.showPetsCheckbox()).not.toBeChecked()

    await page.keyboard.press('b')
    await expect(fightPage.chart.showBossMeleeCheckbox()).not.toBeChecked()
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
    await expect(page).toHaveURL(/focusId=2/)
    await page.keyboard.press('i')
    await expect.poll(() => fightPage.searchParam('players')).toBe('2')

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
    await expect.poll(() => fightPage.searchParam('focusId')).toBe('1')
    await expect.poll(() => fightPage.searchParam('players')).toBe('1')

    await page.keyboard.press('/')
    await expect(playerSearch).toBeVisible()
    await playerSearchInput.fill('blade')
    await page.keyboard.press('Shift+Enter')
    await expect(playerSearch).toHaveCount(0)
    await expect.poll(() => fightPage.searchParam('focusId')).toBe('2')
    await expect.poll(() => fightPage.searchParam('players')).toBe('1,2')

    const shortcutsOverlay = page.getByRole('dialog', {
      name: 'Keyboard shortcuts',
    })
    await expect(shortcutsOverlay).toHaveCount(0)
    await page.keyboard.press('Shift+/')
    await expect(shortcutsOverlay).toBeVisible()
    await expect(shortcutsOverlay).toContainText('Toggle show boss damage')
    await expect(shortcutsOverlay).toContainText('Toggle show pets')
    await expect(shortcutsOverlay).toContainText('Toggle show energize events')
    await expect(shortcutsOverlay).toContainText('Clear isolate')
    await expect(shortcutsOverlay).toContainText('Isolate focused player')
    await expect(shortcutsOverlay).toContainText('Open player search')
    await expect(
      shortcutsOverlay.locator('kbd').filter({ hasText: /^B$/ }),
    ).toBeVisible()
    await expect(
      shortcutsOverlay.locator('kbd').filter({ hasText: /^P$/ }),
    ).toBeVisible()
    await expect(
      shortcutsOverlay.locator('kbd').filter({ hasText: /^E$/ }),
    ).toBeVisible()
    await expect(
      shortcutsOverlay.locator('kbd').filter({ hasText: /^C$/ }),
    ).toBeVisible()
    await expect(
      shortcutsOverlay.locator('kbd').filter({ hasText: /^I$/ }),
    ).toBeVisible()
    const openPlayerSearchRow = shortcutsOverlay
      .getByText('Open player search')
      .locator('xpath=ancestor::li[1]')
    await expect(
      openPlayerSearchRow.locator('kbd').filter({ hasText: /^\/$/ }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(shortcutsOverlay).toHaveCount(0)
  })

  test('clicking a chart point focuses a player and shows total threat values', async ({
    page,
  }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(svgFightUrl)
    await expect(page).toHaveURL(/renderer=svg/)

    await expect.poll(() => fightPage.chart.renderer()).toBe('svg')
    await expect(fightPage.summary.emptyStateText()).toBeVisible()
    const didClick =
      await fightPage.chart.clickSeriesLineByStroke('rgb(199, 156, 110)')
    expect(didClick).toBe(true)
    await expect(page).toHaveURL(/focusId=1/)

    await expect(fightPage.summary.focusedActorText('Aegistank')).toBeVisible()
    await expect(fightPage.summary.metricText('Total threat')).toBeVisible()
    await expect(
      fightPage.summary.totalRow().getByRole('cell').first(),
    ).toHaveText('Total')
    await expect(
      fightPage.summary.totalRow().getByRole('cell').nth(2),
    ).toHaveText('550.00')
  })

  test('focuses a player from the legend focus button', async ({ page }) => {
    const fightPage = new FightPageObject(page)

    await fightPage.goto(svgFightUrl)
    await fightPage.chart.focusLegend('Bladefury')

    await expect(page).toHaveURL(/focusId=2/)
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
    await expect(page.getByTestId('fight-chart-skeleton')).toBeVisible()
    await expect(
      page.getByRole('status', { name: 'Loading fight data' }),
    ).toHaveCount(0)
    await expect.poll(() => fightPage.chart.renderer()).toBe('svg')
    await expect(page.getByTestId('fight-chart-skeleton')).toHaveCount(0)
  })
})
