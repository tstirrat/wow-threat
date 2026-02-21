/**
 * React Router configuration with nested routes.
 */
import { type ReactElement, Suspense, lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import { LandingPage } from '../pages/landing-page'
import { RootLayout } from './root-layout'

const loadReportRouteModule = () => import('./report-layout')

const AuthCompletePage = lazy(() =>
  import('../pages/auth-complete-page').then((module) => ({
    default: module.AuthCompletePage,
  })),
)
const ReportLayout = lazy(() =>
  loadReportRouteModule().then((module) => ({
    default: module.ReportLayout,
  })),
)
const ReportPage = lazy(() =>
  loadReportRouteModule().then((module) => ({
    default: module.ReportPage,
  })),
)
const FightPage = lazy(() =>
  import('../pages/fight-page').then((module) => ({
    default: module.FightPage,
  })),
)
const NotFoundPage = lazy(() =>
  import('../pages/not-found-page').then((module) => ({
    default: module.NotFoundPage,
  })),
)

const pageFallback: ReactElement = (
  <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
    Loading page...
  </p>
)

const withPageSuspense = (element: ReactElement): ReactElement => (
  <Suspense fallback={pageFallback}>{element}</Suspense>
)

export const router: ReturnType<typeof createBrowserRouter> =
  createBrowserRouter([
    {
      path: '/auth/complete',
      element: withPageSuspense(<AuthCompletePage />),
    },
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
          element: withPageSuspense(<ReportLayout />),
          children: [
            {
              index: true,
              element: withPageSuspense(<ReportPage />),
            },
            {
              path: 'fight/:fightId',
              element: withPageSuspense(<FightPage />),
            },
          ],
        },
        {
          path: '*',
          element: withPageSuspense(<NotFoundPage />),
        },
      ],
    },
  ])
