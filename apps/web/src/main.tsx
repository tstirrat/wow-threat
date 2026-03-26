/**
 * Client entrypoint for mounting the React application.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app'
import './index.css'
import { initSentry } from './lib/sentry'
import { initializeTheme } from './lib/theme'

initSentry()
initializeTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
