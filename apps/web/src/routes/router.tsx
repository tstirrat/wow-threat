/**
 * React Router configuration with nested routes.
 */
import { createBrowserRouter } from 'react-router-dom'

import { FightPage } from '../pages/fight-page'
import { LandingPage } from '../pages/landing-page'
import { NotFoundPage } from '../pages/not-found-page'
import { ReportPage } from '../pages/report-page'
import { RootLayout } from './root-layout'

export const router: ReturnType<typeof createBrowserRouter> =
  createBrowserRouter([
    {
      path: '/',
      element: <RootLayout />,
      children: [
        {
          index: true,
          element: <LandingPage />,
        },
        {
          path: 'report/:reportId',
          element: <ReportPage />,
        },
        {
          path: 'report/:reportId/fight/:fightId',
          element: <FightPage />,
        },
        {
          path: '*',
          element: <NotFoundPage />,
        },
      ],
    },
  ])
