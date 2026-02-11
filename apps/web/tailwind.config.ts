/**
 * Tailwind CSS configuration for the web app.
 */
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        surface: 'var(--background)',
        panel: 'var(--card)',
        border: 'var(--border)',
        text: 'var(--foreground)',
        muted: 'var(--muted-foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
      },
    },
  },
  plugins: [],
}

export default config
