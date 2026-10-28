/**
 * Page object for the fight settings side panel opened from the app bar gear.
 */
import { type Locator, type Page } from '@playwright/test'

export class FightSettingsObject {
  constructor(private readonly page: Page) {}

  gearButton(): Locator {
    return this.page.getByRole('button', { name: 'Settings', exact: true })
  }

  panel(): Locator {
    return this.page.getByRole('dialog', { name: 'Settings' })
  }

  closeButton(): Locator {
    return this.panel().getByRole('button', { name: 'Close settings' })
  }

  showPetsCheckbox(): Locator {
    return this.panel().getByRole('checkbox', { name: 'Show pets' })
  }

  showEnergizeEventsCheckbox(): Locator {
    return this.panel().getByRole('checkbox', { name: 'Show energize events' })
  }

  showFixateBandsCheckbox(): Locator {
    return this.panel().getByRole('checkbox', { name: 'Show fixate areas' })
  }

  bossDamageOffToggle(): Locator {
    return this.panel().getByRole('radio', { name: 'Boss damage off' })
  }

  bossDamageMeleeToggle(): Locator {
    return this.panel().getByRole('radio', { name: 'Boss damage melee' })
  }

  bossDamageAllToggle(): Locator {
    return this.panel().getByRole('radio', { name: 'Boss damage all' })
  }

  inferThreatReductionCheckbox(): Locator {
    return this.panel().getByRole('checkbox', {
      name: 'Infer common threat buffs',
    })
  }

  /** Opens the panel from the gear button when it is not already open. */
  async open(): Promise<void> {
    if (await this.panel().isVisible()) {
      return
    }

    await this.gearButton().click()
    await this.panel().waitFor({ state: 'visible' })
  }

  async close(): Promise<void> {
    await this.closeButton().click()
    await this.panel().waitFor({ state: 'hidden' })
  }

  async setShowPets(checked: boolean): Promise<void> {
    await this.setChecked(this.showPetsCheckbox(), checked)
  }

  async setShowEnergizeEvents(checked: boolean): Promise<void> {
    await this.setChecked(this.showEnergizeEventsCheckbox(), checked)
  }

  async setShowFixateBands(checked: boolean): Promise<void> {
    await this.setChecked(this.showFixateBandsCheckbox(), checked)
  }

  async setInferThreatReduction(checked: boolean): Promise<void> {
    await this.setChecked(this.inferThreatReductionCheckbox(), checked)
  }

  async setBossDamageMode(mode: 'off' | 'melee' | 'all'): Promise<void> {
    await this.open()
    const toggle =
      mode === 'off'
        ? this.bossDamageOffToggle()
        : mode === 'melee'
          ? this.bossDamageMeleeToggle()
          : this.bossDamageAllToggle()
    await toggle.click()
  }

  private async setChecked(checkbox: Locator, checked: boolean): Promise<void> {
    await this.open()
    if ((await checkbox.isChecked()) === checked) {
      return
    }

    await checkbox.click()
  }
}
