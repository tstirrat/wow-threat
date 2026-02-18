/**
 * Shared context contract for report-scoped nested routes.
 */
import { useOutletContext } from 'react-router-dom'

import type { WarcraftLogsHost } from '../types/app'
import type { ReportResponse } from '../types/api'

export interface ReportRouteContext {
  reportId: string
  reportData: ReportResponse
  reportHost: WarcraftLogsHost
}

/** Read report route context from nested report pages. */
export function useReportRouteContext(): ReportRouteContext {
  return useOutletContext<ReportRouteContext>()
}
