/**
 * Parse a pasted report URL/ID, record it in history and navigate to the report.
 */
import { getReport } from '@/api/reports'
import { usePostHog } from 'posthog-js/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { defaultHost } from '../lib/constants'
import { buildBossKillNavigationFights } from '../lib/fight-navigation'
import { parseReportInput } from '../lib/wcl-url'
import { useReportIndex } from './use-report-index'

export interface OpenReportState {
  errorMessage: string | null
  isSubmitting: boolean
  openReport: (input: string) => Promise<void>
}

/** Provides the submit handler and status for report URL inputs. */
export function useOpenReport(): OpenReportState {
  const posthog = usePostHog()
  const navigate = useNavigate()
  const { addRecentReport } = useReportIndex()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const openReport = async (input: string): Promise<void> => {
    const parsed = parseReportInput(input, defaultHost)
    if (!parsed) {
      setErrorMessage(
        'Unable to parse report input. Use a fresh/sod/vanilla report URL or a report code.',
      )
      return
    }

    setIsSubmitting(true)
    try {
      const report = await getReport(parsed.reportId)
      const isArchived = report.archiveStatus?.isArchived ?? false
      const isAccessible = report.archiveStatus?.isAccessible ?? true

      addRecentReport({
        reportId: parsed.reportId,
        title: report.title,
        sourceHost: parsed.host,
        lastOpenedAt: Date.now(),
        zoneName: report.zone?.name,
        startTime: report.startTime,
        bossKillCount: buildBossKillNavigationFights(report.fights).length,
        guildName: report.guild?.name ?? null,
        guildFaction: report.guild?.faction ?? null,
        isArchived,
        isAccessible,
        archiveDate: report.archiveStatus?.archiveDate ?? null,
      })

      if (isArchived || !isAccessible) {
        setErrorMessage(
          'This report is archived or inaccessible, so it cannot be opened here.',
        )
        return
      }

      setErrorMessage(null)
      posthog?.capture('search_used', { search_type: 'report' })
      navigate(`/report/${parsed.reportId}`, { state: { host: parsed.host } })
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load report metadata.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return { errorMessage, isSubmitting, openReport }
}
