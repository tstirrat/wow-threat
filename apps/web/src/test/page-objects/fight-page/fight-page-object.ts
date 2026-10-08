/**
 * Root page object for fight-page route interactions.
 */
import { type Page } from '@playwright/test'

import { FightQuickSwitcherObject } from '../components/fight-quick-switcher-object'
import { KeyboardShortcutsOverlayObject } from '../components/keyboard-shortcuts-overlay-object'
import { FightPageHeaderObject } from './fight-page-header-object'
import { FocusedPlayerSummaryObject } from './focused-player-summary-object'
import { PlayerThreatOverridesObject } from './player-threat-overrides-object'
import { ReplayModeObject } from './replay-mode-object'
import { ThreatChartObject } from './threat-chart-object'

export class FightPageObject {
  readonly chart: ThreatChartObject
  readonly header: FightPageHeaderObject
  readonly quickSwitch: FightQuickSwitcherObject
  readonly overrides: PlayerThreatOverridesObject
  readonly replay: ReplayModeObject
  readonly shortcuts: KeyboardShortcutsOverlayObject
  readonly summary: FocusedPlayerSummaryObject

  constructor(readonly page: Page) {
    this.header = new FightPageHeaderObject(page)
    this.quickSwitch = new FightQuickSwitcherObject(page)
    this.overrides = new PlayerThreatOverridesObject(page)
    this.chart = new ThreatChartObject(page)
    this.replay = new ReplayModeObject(page)
    this.shortcuts = new KeyboardShortcutsOverlayObject(page)
    this.summary = new FocusedPlayerSummaryObject(page)
  }

  async goto(url: string): Promise<void> {
    await this.page.goto(url)
  }
}
