/**
 * Root application component with providers.
 */
import { AuthProvider } from '@/auth/auth-provider'
import { ErrorBoundary } from '@/components/error-boundary'
import { ThemeProvider } from '@/components/theme-provider'
import { ReportIndexProvider } from '@/hooks/use-report-index'
import { UserSettingsProvider } from '@/hooks/use-user-settings'
import { QueryClientProvider } from '@tanstack/react-query'
import { PostHogProvider } from 'posthog-js/react'
import type { FC } from 'react'
import { HotkeysProvider } from 'react-hotkeys-hook'
import { RouterProvider } from 'react-router-dom'

import { isPostHogEnabled, posthogApiKey, posthogOptions } from './lib/posthog'
import { createQueryClient } from './lib/query-client'
import { router } from './routes/router'

const queryClient = createQueryClient()

export const App: FC = () => {
  const content = (
    <AuthProvider>
      <UserSettingsProvider>
        <QueryClientProvider client={queryClient}>
          <ReportIndexProvider>
            <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
              <HotkeysProvider>
                <ErrorBoundary>
                  <RouterProvider router={router} />
                </ErrorBoundary>
              </HotkeysProvider>
            </ThemeProvider>
          </ReportIndexProvider>
        </QueryClientProvider>
      </UserSettingsProvider>
    </AuthProvider>
  )

  if (!isPostHogEnabled()) return content

  return (
    <PostHogProvider apiKey={posthogApiKey} options={posthogOptions}>
      {content}
    </PostHogProvider>
  )
}
