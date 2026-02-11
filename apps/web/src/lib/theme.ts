/**
 * Synchronizes the app theme class with the user's system preference.
 */
const themeMediaQuery = '(prefers-color-scheme: dark)'

declare global {
  interface Window {
    __wclThreatThemeInitialized?: boolean
  }
}

function applyTheme(isDarkMode: boolean): void {
  const root = document.documentElement
  root.classList.toggle('dark', isDarkMode)
  root.style.colorScheme = isDarkMode ? 'dark' : 'light'

  window.dispatchEvent(new CustomEvent('themechange'))
}

/**
 * Enables automatic light/dark theme switching based on system settings.
 */
export function initializeTheme(): void {
  if (typeof window === 'undefined') {
    return
  }

  if (window.__wclThreatThemeInitialized) {
    return
  }
  window.__wclThreatThemeInitialized = true

  const mediaQuery = window.matchMedia(themeMediaQuery)
  applyTheme(mediaQuery.matches)

  mediaQuery.addEventListener('change', (event) => {
    applyTheme(event.matches)
  })
}
