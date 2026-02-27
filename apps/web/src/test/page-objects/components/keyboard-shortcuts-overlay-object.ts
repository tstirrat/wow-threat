/**
 * Page object for global keyboard shortcuts overlay interactions.
 */
import { type Locator, type Page } from '@playwright/test'

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export class KeyboardShortcutsOverlayObject {
  constructor(private readonly page: Page) {}

  dialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  }

  shortcutListItem(description: string): Locator {
    return this.dialog()
      .getByRole('listitem')
      .filter({ hasText: description })
      .first()
  }

  shortcutKey(description: string, key: string): Locator {
    return this.shortcutListItem(description)
      .locator('kbd')
      .filter({ hasText: new RegExp(`^${escapeRegExp(key)}$`) })
  }

  async open(): Promise<void> {
    await this.page.keyboard.press('Shift+/')
  }

  async closeWithEscape(): Promise<void> {
    await this.page.keyboard.press('Escape')
  }

  async clickOutside(): Promise<void> {
    await this.dialog().click({
      position: {
        x: 8,
        y: 8,
      },
    })
  }
}
