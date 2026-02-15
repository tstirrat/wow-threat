/**
 * Root application component with providers.
 */
import { QueryClientProvider } from '@tanstack/react-query'
import type { FC } from 'react'
import { RouterProvider } from 'react-router-dom'

import { createQueryClient } from './lib/query-client'
import { router } from './routes/router'

const queryClient = createQueryClient()

export const App: FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
