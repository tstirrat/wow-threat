/**
 * Page object for the floating per-player threat overrides panel.
 */
import { type Locator, type Page } from '@playwright/test'

export class PlayerThreatOverridesObject {
  constructor(private readonly page: Page) {}

  root(playerName: string): Locator {
    return this.page.getByRole('complementary', {
      name: `Threat overrides for ${playerName}`,
    })
  }

  auraState(
    playerName: string,
    auraName: string,
    state: 'auto' | 'off' | 'on',
  ): Locator {
    return this.root(playerName).getByRole('radio', {
      name: `${auraName} ${state}`,
    })
  }

  talentRank(playerName: string, talentName: string): Locator {
    return this.root(playerName).getByRole('combobox', {
      name: `${talentName} rank override`,
    })
  }

  async setAuraState(
    playerName: string,
    auraName: string,
    state: 'auto' | 'off' | 'on',
  ): Promise<void> {
    await this.auraState(playerName, auraName, state).click()
  }

  async setTalentRank(
    playerName: string,
    talentName: string,
    rankLabel: string,
  ): Promise<void> {
    await this.talentRank(playerName, talentName).click()
    await this.page
      .getByRole('option', { name: rankLabel, exact: true })
      .click()
  }
}
