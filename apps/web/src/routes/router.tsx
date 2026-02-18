/**
 * React Router configuration with nested routes.
 */
import { createBrowserRouter } from 'react-router-dom'

import { FightPage } from '../pages/fight-page'
import { LandingPage } from '../pages/landing-page'
import { NotFoundPage } from '../pages/not-found-page'
import { ReportPage } from '../pages/report-page'
import { ReportLayout } from './report-layout'
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
          element: <ReportLayout />,
          children: [
            {
              index: true,
              element: <ReportPage />,
            },
            {
              path: 'fight/:fightId',
              element: <FightPage />,
            },
          ],
        },
        {
          path: '*',
          element: <NotFoundPage />,
        },
      ],
    },
  ])
