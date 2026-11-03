/**
 * Page object for the app bar's "Open a report" modal dialog.
 */
import { type Locator, type Page } from '@playwright/test'

export class OpenReportDialogObject {
  constructor(private readonly page: Page) {}

  triggerButton(): Locator {
    return this.page
      .getByTestId('app-bar')
      .getByRole('button', { name: 'Open report' })
  }

  dialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Open a report' })
  }

  input(): Locator {
    return this.dialog().getByLabel('Warcraft Logs report URL or code')
  }

  error(): Locator {
    return this.dialog().getByRole('alert')
  }

  cancelButton(): Locator {
    return this.dialog().getByRole('button', { name: 'Cancel' })
  }

  async open(): Promise<void> {
    await this.triggerButton().click()
  }

  async submit(value: string): Promise<void> {
    await this.input().fill(value)
    await this.input().press('Enter')
  }
}
